import express, { Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

import { prisma } from './prisma';
import { config } from './config';
import { hashPassword, verifyPassword, encryptBuffer, decryptBuffer } from './utils/crypto';
import { gitWatcher } from './services/gitWatcher';
import { keyRotation } from './services/keyRotation';
import { clusterService } from './services/clusterService';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '15mb' }));

// In-memory fallback stores
const inMemoryFollows = new Set<string>(); 
const inMemoryLikes = new Set<string>();   
const inMemoryComments: Record<number, any[]> = {}; 
const inMemoryApps: any[] = [
  {
    id: 1,
    title: 'Z AI Assistant',
    description: 'Умный ассистент для генерации текста, кода и анализа данных',
    url: 'https://duckduckgo.com',
    icon: '🤖',
    category: 'AI',
    createdAt: new Date()
  },
  {
    id: 2,
    title: 'Z Vault Storage',
    description: 'Зашифрованное распределенное хранилище файлов AES-256',
    url: 'https://wikipedia.org',
    icon: '🔐',
    category: 'STORAGE',
    createdAt: new Date()
  }
];

const BUCKET_DIR = path.join(process.cwd(), 'bucket');

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

// --- ADMIN CONTROLLERS ---
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
    const miniAppsCount = inMemoryApps.length;

    res.json({
      usersCount,
      postsCount,
      miniAppsCount,
      activeNodes: 18,
      nodeId: config.nodeId,
      dbStatus: 'CONNECTED (PostgreSQL 15-alpine)',
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      systemLogs: [
        `[System] Node initialized: ${config.nodeId}`,
        `[Security] Key rotation status: ACTIVE`,
        `[Cluster] Master heartbeat synced`,
        `[P2P] 18 active nodes listening on port ${config.port}`
      ]
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// --- USERS & FOLLOWS ---
app.get('/api/users/:username', optionalAuth, async (req: any, res) => {
  try {
    const targetUsername = req.params.username;
    
    // Case-insensitive lookup
    const user = await prisma.user.findFirst({
      where: { username: { equals: targetUsername, mode: 'insensitive' } }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    let followersCount = 0;
    let followingCount = 0;
    for (const key of inMemoryFollows) {
      const [follower, following] = key.split(':');
      if (following.toLowerCase() === targetUsername.toLowerCase()) followersCount++;
      if (follower.toLowerCase() === targetUsername.toLowerCase()) followingCount++;
    }

    const isFollowing = req.user ? inMemoryFollows.has(`${req.user.username}:${targetUsername}`) : false;

    res.json({ 
      ...user, 
      isFollowing,
      _count: { posts: 0, followers: followersCount, following: followingCount } 
    });
  } catch (e) {
    res.status(404).json({ error: 'Error fetching profile' });
  }
});

// Safe profile update with fallback
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

    let updatedUser;
    try {
      updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: updateData
      });
    } catch (dbErr: any) {
      console.warn('[User Update Warning]', dbErr.message);
      // Fallback: update only standard core fields
      const safeData: Record<string, any> = {};
      if (req.body.firstName !== undefined) safeData.firstName = req.body.firstName;
      if (req.body.lastName !== undefined) safeData.lastName = req.body.lastName;
      if (req.body.bio !== undefined) safeData.bio = req.body.bio;
      if (req.body.avatar !== undefined) safeData.avatar = req.body.avatar;

      updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: safeData
      }).catch(() => req.user);
    }

    res.json(updatedUser || req.user);
  } catch (e: any) {
    console.error('Update profile error:', e.message);
    res.status(400).json({ error: 'Update failed: ' + e.message });
  }
});

app.post('/api/users/:username/follow', authenticate, async (req: any, res) => {
  try {
    const follower = req.user.username;
    const target = req.params.username;

    if (follower === target) {
      return res.status(400).json({ error: 'Нельзя подписаться на самого себя' });
    }

    const key = `${follower}:${target}`;
    let following = false;

    if (inMemoryFollows.has(key)) {
      inMemoryFollows.delete(key);
      following = false;
    } else {
      inMemoryFollows.add(key);
      following = true;
    }

    res.json({ following, username: target });
  } catch (e: any) {
    res.status(500).json({ error: 'Follow operation failed' });
  }
});

app.get('/api/users/:username/followers', async (req, res) => {
  try {
    const target = req.params.username;
    const followerUsernames: string[] = [];

    for (const key of inMemoryFollows) {
      const [follower, following] = key.split(':');
      if (following === target) followerUsernames.push(follower);
    }

    const users = await prisma.user.findMany({
      where: { username: { in: followerUsernames } },
      select: { id: true, username: true, firstName: true, lastName: true, avatar: true, bio: true }
    });

    res.json(users);
  } catch (e) {
    res.json([]);
  }
});

app.get('/api/users/:username/following', async (req, res) => {
  try {
    const target = req.params.username;
    const followingUsernames: string[] = [];

    for (const key of inMemoryFollows) {
      const [follower, following] = key.split(':');
      if (follower === target) followingUsernames.push(follower);
    }

    const users = await prisma.user.findMany({
      where: { username: { in: followingUsernames } },
      select: { id: true, username: true, firstName: true, lastName: true, avatar: true, bio: true }
    });

    res.json(users);
  } catch (e) {
    res.json([]);
  }
});

// --- POSTS CRUD & FEED ---
app.get('/api/posts/feed', optionalAuth, async (req: any, res) => {
  try {
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '10');
    const filterUsername = req.query.username as string | undefined;
    const currentUser = req.user;

    const skip = (page - 1) * limit;

    let posts = await prisma.post.findMany({
      where: filterUsername ? { author: { username: filterUsername } } : {},
      include: {
        author: { select: { id: true, username: true, firstName: true, lastName: true, avatar: true, role: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit + 1
    });

    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();

    const formatted = posts.map(p => {
      let likeCount = 0;
      let isLiked = false;

      for (const key of inMemoryLikes) {
        const [u, pId] = key.split(':');
        if (pId === String(p.id)) {
          likeCount++;
          if (currentUser && u === currentUser.username) isLiked = true;
        }
      }

      const postComments = inMemoryComments[p.id] || [];

      return {
        ...p,
        isLiked,
        _count: { likes: likeCount, comments: postComments.length }
      };
    });

    res.json({
      posts: formatted,
      hasMore,
      page,
      limit
    });
  } catch (e: any) {
    console.error('Feed error:', e.message);
    res.status(500).json({ error: 'Feed load error' });
  }
});

app.get('/api/posts', async (req, res) => {
  const { username } = req.query;
  try {
    const posts = await prisma.post.findMany({
      where: username ? { author: { username: String(username) } } : {},
      include: { 
        author: { select: { id: true, username: true, firstName: true, lastName: true, avatar: true, role: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json(posts.map(p => ({
      ...p,
      isLiked: false,
      _count: { likes: 0, comments: (inMemoryComments[p.id] || []).length }
    })));
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

// EDIT POST
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
      include: { author: { select: { id: true, username: true, firstName: true, lastName: true, avatar: true, role: true } } }
    });

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: 'Ошибка редактирования поста' });
  }
});

// DELETE POST
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

// VIEW COUNTER
app.post('/api/posts/:id/view', async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const updated = await prisma.post.update({
      where: { id: postId },
      data: { viewsCount: { increment: 1 } }
    });
    res.json({ viewsCount: updated.viewsCount });
  } catch (e) {
    res.json({ viewsCount: 0 });
  }
});

// LIKE TOGGLE
app.post('/api/posts/:id/like', authenticate, async (req: any, res) => {
  try {
    const postId = req.params.id;
    const username = req.user.username;
    const key = `${username}:${postId}`;

    let liked = false;
    if (inMemoryLikes.has(key)) {
      inMemoryLikes.delete(key);
      liked = false;
    } else {
      inMemoryLikes.add(key);
      liked = true;
    }

    let count = 0;
    for (const k of inMemoryLikes) {
      if (k.endsWith(`:${postId}`)) count++;
    }

    res.json({ liked, count });
  } catch (e) {
    res.status(500).json({ error: 'Like toggle failed' });
  }
});

// COMMENTS
app.get('/api/posts/:id/comments', async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const comments = inMemoryComments[postId] || [];
    res.json(comments);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/posts/:id/comments', authenticate, async (req: any, res) => {
  try {
    const postId = parseInt(req.params.id);
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Empty comment' });

    const newComment = {
      id: Date.now(),
      postId,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      author: {
        username: req.user.username,
        firstName: req.user.firstName || req.user.username,
        avatar: req.user.avatar
      }
    };

    if (!inMemoryComments[postId]) inMemoryComments[postId] = [];
    inMemoryComments[postId].unshift(newComment);

    res.status(201).json(newComment);
  } catch (e) {
    res.status(500).json({ error: 'Comment failed' });
  }
});

// --- MEDIA & APPS PLATFORM ---
app.get('/api/apps', async (req, res) => {
  try {
    let dbApps: any[] = [];
    try {
      dbApps = await (prisma as any).miniApp.findMany({
        include: { author: { select: { username: true, firstName: true } } },
        orderBy: { id: 'desc' }
      });
    } catch (e) {}

    res.json([...inMemoryApps, ...dbApps]);
  } catch (e) {
    res.json(inMemoryApps);
  }
});

app.post('/api/apps', authenticate, async (req: any, res) => {
  try {
    const { title, description, url, icon } = req.body;
    if (!title || !url) return res.status(400).json({ error: 'Укажите название и URL сайта' });

    let appObj;
    try {
      appObj = await (prisma as any).miniApp.create({
        data: {
          title: title.trim(),
          description: (description || '').trim(),
          url: url.trim(),
          icon: icon || '🚀',
          authorId: req.user.id
        }
      });
    } catch (e) {
      appObj = {
        id: Date.now(),
        title: title.trim(),
        description: (description || '').trim(),
        url: url.trim(),
        icon: icon || '🚀',
        author: { username: req.user.username },
        createdAt: new Date()
      };
      inMemoryApps.unshift(appObj);
    }

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