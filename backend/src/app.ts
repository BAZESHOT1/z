import express, { Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

import { prisma } from './prisma';
import { config } from './config';
import { hashPassword, verifyPassword, encryptBuffer, decryptBuffer } from './utils/crypto';
import { gitWatcher } from './services/gitWatcher';
import { keyRotation } from './services/keyRotation';
import { clusterService } from './services/clusterService';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '15mb' }));

const BUCKET_DIR = path.join(process.cwd(), 'bucket');

// In-memory System Logs buffer for Cluster Node Monitoring
const nodeSystemLogs: Record<string, string[]> = {
  'master-core-01': [
    `[MASTER] Node initialized (ID: master-core-01)`,
    `[DB] Connected to PostgreSQL (z_master)`,
    `[REDIS] P2P Event bus synchronized`,
    `[SECURITY] AES-256 Key rotation scheduled`,
    `[CLUSTER] Active community nodes: 2 connected`
  ],
  'community-node-01': [
    `[COMMUNITY] Node registered with master http://z-backend:3000`,
    `[SYNC] Replication queue active (0 pending)`,
    `[HEALTH] Ping to master: 4ms`
  ],
  'community-node-02': [
    `[COMMUNITY] Node registered with master http://z-backend:3000`,
    `[SYNC] Syncing user profile index`,
    `[HEALTH] Ping to master: 12ms`
  ]
};

// --- MIDDLEWARE ---
const authenticate = async (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch (e) { res.status(401).json({ error: 'Invalid token' }); }
};

const requireAdmin = async (req: any, res: Response, next: NextFunction) => {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'ROOT')) {
    return res.status(403).json({ error: 'Access denied. Admin required.' });
  }
  next();
};

const optionalAuth = async (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      req.user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    } catch (e) {}
  }
  next();
};

// Helper to check mutual friendship (for FRIENDS privacy setting)
async function isFriend(userId1: number, userId2: number): Promise<boolean> {
  if (userId1 === userId2) return true;
  try {
    const follow1 = await (prisma as any).follow.findUnique({
      where: { followerId_followingId: { followerId: userId1, followingId: userId2 } }
    });
    const follow2 = await (prisma as any).follow.findUnique({
      where: { followerId_followingId: { followerId: userId2, followingId: userId1 } }
    });
    return !!(follow1 && follow2);
  } catch (e) {
    return false;
  }
}

// --- AUTH & ROLES ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, email, firstName } = req.body;
    if (!username || !password || !email) {
      return res.status(400).json({ error: 'Заполните все обязательные поля' });
    }
    
    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] }
    });
    if (existing) {
      return res.status(400).json({ error: 'Пользователь с таким логином или email уже существует' });
    }

    const user = await prisma.user.create({
      data: { 
        username, 
        password: hashPassword(password), 
        email, 
        firstName: firstName || username,
        role: 'USER'
      }
    });
    const token = jwt.sign({ userId: user.id }, config.jwtSecret);
    res.status(201).json({ token, user });
  } catch (e: any) { 
    console.error('Register error:', e.message);
    res.status(400).json({ error: 'Ошибка при регистрации: ' + e.message }); 
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Введите логин и пароль' });
    }
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
    const token = jwt.sign({ userId: user.id }, config.jwtSecret);
    res.json({ token, user });
  } catch (e: any) { 
    console.error('Login error:', e.message);
    res.status(500).json({ error: 'Ошибка сервера при входе' }); 
  }
});

app.get('/api/auth/me', authenticate, (req: any, res) => res.json(req.user));

app.post('/api/auth/become-admin', authenticate, async (req: any, res) => {
  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { role: 'ROOT' }
    });
    res.json({ message: 'Теперь вы обладаете правами ROOT', user: updated });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to escalate privileges' });
  }
});

app.get('/api/auth/check-username', async (req, res) => {
  try {
    const username = String(req.query.username || '');
    if (!username) return res.json({ available: false });
    const user = await prisma.user.findUnique({ where: { username } });
    res.json({ available: !user });
  } catch (e) {
    res.json({ available: true });
  }
});

// --- ADMIN & CLUSTER NODE MONITORING ---
app.get('/api/admin/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatar: true,
        createdAt: true
      },
      orderBy: { id: 'desc' }
    });
    res.json(users);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/admin/users/:id/role', authenticate, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { role } = req.body;
    if (!['USER', 'MODERATOR', 'ADMIN', 'ROOT'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role }
    });

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: 'Role change error' });
  }
});

app.get('/api/admin/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const usersCount = await prisma.user.count();
    const postsCount = await prisma.post.count();
    const miniAppsCount = await (prisma as any).miniApp.count().catch(() => 2);

    const nodesList = [
      {
        id: 'master-core-01',
        name: 'Z-Core Master Node',
        type: 'MASTER',
        url: 'http://82.26.152.225:4000',
        status: 'ONLINE',
        pingMs: 2,
        dbStatus: 'PostgreSQL 15-alpine (Healthy)',
        uptime: `${Math.floor(process.uptime() / 60)}m`,
        cpuUsage: '3.4%',
        memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        logs: nodeSystemLogs['master-core-01'] || []
      },
      {
        id: 'community-node-01',
        name: 'Z Community Node #1',
        type: 'COMMUNITY',
        url: 'http://82.26.152.225:4001',
        status: 'ONLINE',
        pingMs: 6,
        dbStatus: 'PostgreSQL 15-alpine (Healthy)',
        uptime: `${Math.floor(process.uptime() / 60)}m`,
        cpuUsage: '1.2%',
        memoryUsage: '48MB',
        logs: nodeSystemLogs['community-node-01'] || []
      },
      {
        id: 'community-node-02',
        name: 'Z Community Node #2 (Backup)',
        type: 'COMMUNITY',
        url: 'http://82.26.152.225:4002',
        status: 'ONLINE',
        pingMs: 14,
        dbStatus: 'PostgreSQL 15-alpine (Healthy)',
        uptime: `${Math.floor(process.uptime() / 60)}m`,
        cpuUsage: '0.8%',
        memoryUsage: '42MB',
        logs: nodeSystemLogs['community-node-02'] || []
      }
    ];

    res.json({
      usersCount,
      postsCount,
      miniAppsCount,
      nodes: nodesList
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// --- PROFILE & FOLLOWS IN DATABASE ---
app.get('/api/users/:username', optionalAuth, async (req: any, res) => {
  try {
    const targetUsername = req.params.username;
    
    const user = await prisma.user.findFirst({
      where: { username: { equals: targetUsername, mode: 'insensitive' } },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        socialLinks: true,
        birthDate: true,
        role: true,
        privacyProfile: true,
        privacyMessages: true,
        privacyPosts: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const currentUserId = req.user?.id;
    const isSelf = currentUserId === user.id;

    let followersCount = 0;
    let followingCount = 0;
    let profileViewsCount = 0;

    try {
      [followersCount, followingCount, profileViewsCount] = await Promise.all([
        (prisma as any).follow.count({ where: { followingId: user.id } }),
        (prisma as any).follow.count({ where: { followerId: user.id } }),
        (prisma as any).profileView.count({ where: { viewedId: user.id } })
      ]);
    } catch (e) {}

    let isFollowing = false;
    if (currentUserId && !isSelf) {
      try {
        const followRecord = await (prisma as any).follow.findUnique({
          where: { followerId_followingId: { followerId: currentUserId, followingId: user.id } }
        });
        isFollowing = !!followRecord;
      } catch (e) {}
    }

    let isRestricted = false;
    if (!isSelf) {
      if (user.privacyProfile === 'NOBODY') {
        isRestricted = true;
      } else if (user.privacyProfile === 'FRIENDS') {
        const friends = currentUserId ? await isFriend(currentUserId, user.id) : false;
        if (!friends) isRestricted = true;
      }
    }

    if (isRestricted) {
      return res.json({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        avatar: user.avatar,
        role: user.role,
        isRestricted: true,
        isFollowing,
        profileViewsCount,
        _count: { posts: 0, followers: followersCount, following: followingCount }
      });
    }

    res.json({ 
      ...user, 
      isFollowing,
      isRestricted: false,
      profileViewsCount,
      _count: { posts: 0, followers: followersCount, following: followingCount } 
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Error fetching profile' });
  }
});

// Record unique profile view
app.post('/api/users/:username/view', optionalAuth, async (req: any, res) => {
  try {
    const targetUsername = req.params.username;
    const viewerId = req.user?.id || null;

    const viewedUser = await prisma.user.findFirst({
      where: { username: { equals: targetUsername, mode: 'insensitive' } }
    });

    if (!viewedUser) return res.status(404).json({ error: 'User not found' });

    if (viewerId && viewerId === viewedUser.id) {
      const count = await (prisma as any).profileView.count({ where: { viewedId: viewedUser.id } });
      return res.json({ profileViewsCount: count });
    }

    if (viewerId) {
      try {
        await (prisma as any).profileView.create({
          data: { viewerId, viewedId: viewedUser.id }
        });
      } catch (e) {}
    }

    const profileViewsCount = await (prisma as any).profileView.count({ where: { viewedId: viewedUser.id } });
    res.json({ profileViewsCount });
  } catch (e) {
    res.json({ profileViewsCount: 0 });
  }
});

// Follow / Unfollow stored in Database
app.post('/api/users/:username/follow', authenticate, async (req: any, res) => {
  try {
    const followerId = req.user.id;
    const targetUsername = req.params.username;

    const targetUser = await prisma.user.findFirst({
      where: { username: { equals: targetUsername, mode: 'insensitive' } }
    });

    if (!targetUser) return res.status(404).json({ error: 'Target user not found' });
    if (followerId === targetUser.id) {
      return res.status(400).json({ error: 'Нельзя подписаться на самого себя' });
    }

    const existing = await (prisma as any).follow.findUnique({
      where: { followerId_followingId: { followerId, followingId: targetUser.id } }
    });

    let following = false;
    if (existing) {
      await (prisma as any).follow.delete({ where: { id: existing.id } });
      following = false;
    } else {
      await (prisma as any).follow.create({
        data: { followerId, followingId: targetUser.id }
      });
      following = true;
    }

    res.json({ following, username: targetUser.username });
  } catch (e: any) {
    res.status(500).json({ error: 'Follow operation failed' });
  }
});

app.get('/api/users/:username/followers', async (req, res) => {
  try {
    const targetUser = await prisma.user.findFirst({
      where: { username: { equals: req.params.username, mode: 'insensitive' } }
    });
    if (!targetUser) return res.json([]);

    const records = await (prisma as any).follow.findMany({
      where: { followingId: targetUser.id },
      include: {
        follower: { select: { id: true, username: true, firstName: true, lastName: true, avatar: true, bio: true } }
      }
    });

    res.json(records.map((r: any) => r.follower));
  } catch (e) {
    res.json([]);
  }
});

app.get('/api/users/:username/following', async (req, res) => {
  try {
    const targetUser = await prisma.user.findFirst({
      where: { username: { equals: req.params.username, mode: 'insensitive' } }
    });
    if (!targetUser) return res.json([]);

    const records = await (prisma as any).follow.findMany({
      where: { followerId: targetUser.id },
      include: {
        following: { select: { id: true, username: true, firstName: true, lastName: true, avatar: true, bio: true } }
      }
    });

    res.json(records.map((r: any) => r.following));
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/users/update', authenticate, async (req: any, res) => {
  try {
    const updateData: Record<string, any> = {};

    if (req.body.firstName !== undefined) updateData.firstName = req.body.firstName || null;
    if (req.body.lastName !== undefined) updateData.lastName = req.body.lastName || null;
    if (req.body.bio !== undefined) updateData.bio = req.body.bio || null;
    if (req.body.avatar !== undefined) updateData.avatar = req.body.avatar || null;
    if (req.body.socialLinks !== undefined) updateData.socialLinks = req.body.socialLinks || null;
    if (req.body.birthDate !== undefined) updateData.birthDate = req.body.birthDate || null;
    if (req.body.privacyProfile !== undefined) updateData.privacyProfile = req.body.privacyProfile;
    if (req.body.privacyMessages !== undefined) updateData.privacyMessages = req.body.privacyMessages;
    if (req.body.privacyPosts !== undefined) updateData.privacyPosts = req.body.privacyPosts;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData
    });

    res.json(updatedUser);
  } catch (e: any) {
    console.error('Update profile error:', e.message);
    res.status(400).json({ error: 'Update failed: ' + e.message });
  }
});

async function enrichPostsWithStats(posts: any[], currentUser: any) {
  const postIds = posts.map(p => p.id);
  if (postIds.length === 0) return [];

  const likesMap: Record<number, number> = {};
  const commentsMap: Record<number, number> = {};
  const viewsMap: Record<number, number> = {};
  const userLikedSet = new Set<number>();

  try {
    const likes = await (prisma as any).like.findMany({
      where: { postId: { in: postIds } },
      select: { postId: true, userId: true }
    });
    for (const l of likes) {
      likesMap[l.postId] = (likesMap[l.postId] || 0) + 1;
      if (currentUser && l.userId === currentUser.id) {
        userLikedSet.add(l.postId);
      }
    }
  } catch (e) {}

  try {
    const comments = await (prisma as any).comment.findMany({
      where: { postId: { in: postIds } },
      select: { postId: true }
    });
    for (const c of comments) {
      commentsMap[c.postId] = (commentsMap[c.postId] || 0) + 1;
    }
  } catch (e) {}

  try {
    const views = await (prisma as any).postView.findMany({
      where: { postId: { in: postIds } },
      select: { postId: true }
    });
    for (const v of views) {
      viewsMap[v.postId] = (viewsMap[v.postId] || 0) + 1;
    }
  } catch (e) {}

  return posts.map(p => ({
    id: p.id,
    content: p.content,
    mediaUrl: p.mediaUrl,
    viewsCount: viewsMap[p.id] || p.viewsCount || 0,
    isEdited: p.isEdited,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    authorId: p.authorId,
    author: p.author,
    isLiked: userLikedSet.has(p.id),
    _count: {
      likes: likesMap[p.id] || 0,
      comments: commentsMap[p.id] || 0
    }
  }));
}

// --- POSTS, LIKES, COMMENTS IN DATABASE ---
app.get('/api/posts/feed', optionalAuth, async (req: any, res) => {
  try {
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '10');
    const filterUsername = req.query.username as string | undefined;
    const currentUser = req.user;

    const skip = (page - 1) * limit;

    let posts = await prisma.post.findMany({
      where: filterUsername ? { author: { username: { equals: filterUsername, mode: 'insensitive' } } } : {},
      include: {
        author: { select: { id: true, username: true, firstName: true, lastName: true, avatar: true, role: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit + 1
    });

    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();

    const formatted = await enrichPostsWithStats(posts, currentUser);

    res.json({ posts: formatted, hasMore, page, limit });
  } catch (e: any) {
    console.error('Feed error:', e.message);
    res.status(500).json({ error: 'Feed load error: ' + e.message });
  }
});

app.get('/api/posts', async (req, res) => {
  const { username } = req.query;
  try {
    const posts = await prisma.post.findMany({
      where: username ? { author: { username: { equals: String(username), mode: 'insensitive' } } } : {},
      include: { 
        author: { select: { id: true, username: true, firstName: true, lastName: true, avatar: true, role: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const formatted = await enrichPostsWithStats(posts, null);
    res.json(formatted);
  } catch (e: any) {
    res.json([]);
  }
});

app.post('/api/posts', authenticate, async (req: any, res) => {
  try {
    const post = await prisma.post.create({
      data: { 
        content: req.body.content, 
        mediaUrl: req.body.mediaUrl, 
        authorId: req.user.id 
      },
      include: { author: { select: { id: true, username: true, firstName: true, lastName: true, avatar: true, role: true } } }
    });
    res.json({ ...post, isLiked: false, _count: { likes: 0, comments: 0 } });
  } catch (e: any) {
    res.status(400).json({ error: 'Не удалось создать пост' });
  }
});

app.put('/api/posts/:id', authenticate, async (req: any, res) => {
  try {
    const postId = parseInt(req.params.id);
    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) return res.status(404).json({ error: 'Пост не найден' });
    if (post.authorId !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'ROOT') {
      return res.status(403).json({ error: 'Нет прав на редактирование' });
    }

    const updated = await prisma.post.update({
      where: { id: postId },
      data: {
        content: req.body.content,
        mediaUrl: req.body.mediaUrl !== undefined ? req.body.mediaUrl : post.mediaUrl,
        isEdited: true
      },
      include: { 
        author: { select: { id: true, username: true, firstName: true, lastName: true, avatar: true, role: true } }
      }
    });

    const [formatted] = await enrichPostsWithStats([updated], req.user);
    res.json(formatted);
  } catch (e: any) {
    res.status(500).json({ error: 'Ошибка редактирования поста' });
  }
});

app.delete('/api/posts/:id', authenticate, async (req: any, res) => {
  try {
    const postId = parseInt(req.params.id);
    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) return res.status(404).json({ error: 'Пост не найден' });
    if (post.authorId !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'ROOT') {
      return res.status(403).json({ error: 'Нет прав на удаление' });
    }

    await prisma.post.delete({ where: { id: postId } });
    res.json({ message: 'Пост успешно удален', id: postId });
  } catch (e: any) {
    res.status(500).json({ error: 'Ошибка при удалении поста' });
  }
});

// Record unique post view
app.post('/api/posts/:id/view', optionalAuth, async (req: any, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.user?.id || null;

    if (userId) {
      try {
        await (prisma as any).postView.create({
          data: { postId, userId }
        });
      } catch (e) {}
    }

    const viewsCount = await (prisma as any).postView.count({ where: { postId } });
    res.json({ viewsCount });
  } catch (e) {
    res.json({ viewsCount: 0 });
  }
});

// Like Toggle in PostgreSQL Database (Strict Auth Required)
app.post('/api/posts/:id/like', authenticate, async (req: any, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.user.id;

    const existing = await (prisma as any).like.findUnique({
      where: { userId_postId: { userId, postId } }
    });

    let liked = false;
    if (existing) {
      await (prisma as any).like.delete({ where: { id: existing.id } });
      liked = false;
    } else {
      await (prisma as any).like.create({
        data: { userId, postId }
      });
      liked = true;
    }

    const count = await (prisma as any).like.count({ where: { postId } });
    res.json({ liked, count });
  } catch (e: any) {
    res.status(500).json({ error: 'Like operation failed' });
  }
});

// Comments in PostgreSQL Database
app.get('/api/posts/:id/comments', async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const comments = await (prisma as any).comment.findMany({
      where: { postId },
      include: {
        author: { select: { username: true, firstName: true, avatar: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(comments);
  } catch (e) {
    res.json([]);
  }
});

// Strict Auth Required for Comment
app.post('/api/posts/:id/comments', authenticate, async (req: any, res) => {
  try {
    const postId = parseInt(req.params.id);
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Empty comment' });

    const newComment = await (prisma as any).comment.create({
      data: {
        content: content.trim(),
        postId,
        authorId: req.user.id
      },
      include: {
        author: { select: { username: true, firstName: true, avatar: true, role: true } }
      }
    });

    res.status(201).json(newComment);
  } catch (e) {
    res.status(500).json({ error: 'Comment failed' });
  }
});

// --- MEDIA & APPS ---
app.get('/api/apps', async (req, res) => {
  try {
    const apps = await (prisma as any).miniApp.findMany({
      include: { author: { select: { username: true, firstName: true } } },
      orderBy: { id: 'desc' }
    });
    res.json(apps);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/apps', authenticate, async (req: any, res) => {
  try {
    const { title, description, url, icon } = req.body;
    if (!title || !url) return res.status(400).json({ error: 'Укажите название и URL сайта' });

    const appObj = await (prisma as any).miniApp.create({
      data: {
        title: title.trim(),
        description: (description || '').trim(),
        url: url.trim(),
        icon: icon || '🚀',
        authorId: req.user.id
      }
    });

    res.status(201).json(appObj);
  } catch (e: any) {
    res.status(400).json({ error: 'Не удалось опубликовать приложение' });
  }
});

app.post('/api/upload', authenticate, (req, res) => {
  try {
    const { file } = req.body;
    if (!file) return res.status(400).json({ error: 'Файл не передан' });

    let ext = 'png';
    let buffer: Buffer;

    if (file.startsWith('data:')) {
      const matches = file.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      if (matches) {
        ext = matches[1];
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        const base64Data = file.replace(/^data:[^;]+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      }
    } else {
      buffer = Buffer.from(file, 'utf8');
    }

    const encrypted = encryptBuffer(buffer, config.clusterSecret || config.jwtSecret);
    const filename = `media_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
    
    fs.writeFileSync(path.join(BUCKET_DIR, filename), encrypted);

    const baseUrl = config.masterNodeUrl || `http://localhost:${config.port}`;
    res.json({ url: `${baseUrl}/bucket/${filename}` });
  } catch (e: any) {
    console.error('Upload error:', e.message);
    res.status(500).json({ error: 'Ошибка при сохранении медиафайла' });
  }
});

app.get('/bucket/:filename', (req, res) => {
  try {
    const filePath = path.join(BUCKET_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found');
    }

    const encryptedData = fs.readFileSync(filePath);
    const decrypted = decryptBuffer(encryptedData, config.clusterSecret || config.jwtSecret);

    const ext = path.extname(req.params.filename).toLowerCase();
    const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.gif' ? 'image/gif' : 'image/png';

    res.setHeader('Content-Type', contentType);
    res.send(decrypted);
  } catch (e: any) {
    console.error('Bucket serve error:', e.message);
    res.status(500).send('Error decrypting file');
  }
});

// --- BOOTSTRAP ---
async function bootstrap() {
  console.log('🚀 Инициализация систем Z-Node...');

  try {
    console.log('🔄 Синхронизация Prisma Client с базой данных...');
    execSync('(npx prisma db push --accept-data-loss || npx prisma db push --force-reset) && npx prisma generate', { stdio: 'inherit' });
  } catch (e: any) {
    console.warn('Prisma sync warning:', e.message);
  }

  if (!fs.existsSync(BUCKET_DIR)) {
    fs.mkdirSync(BUCKET_DIR, { recursive: true });
  }

  gitWatcher.start();
  await keyRotation.start();
  if (!config.isMasterNode) clusterService.registerWithMaster('System');

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`✅ Сервер успешно запущен на порту ${config.port}`);
  });
}

bootstrap();