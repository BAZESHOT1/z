import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { exec } from 'child_process';
import crypto from 'crypto';
import { PrismaClient, PrivacyLevel } from '@prisma/client';
import { config } from './config';
import { hashPassword, verifyPassword, encryptField, decryptField } from './utils/crypto';

const app = express();
export const prisma = new PrismaClient();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Webhook for Auto-Deploy
app.post('/api/webhooks/deploy', (req: Request, res: Response) => {
  const signature = req.headers['x-hub-signature-256'];
  const secret = config.jwtSecret;

  if (!signature) return res.status(401).send('No signature');

  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

  if (signature !== digest) return res.status(401).send('Invalid signature');

  console.log('[Deploy] Starting git pull...');
  exec('git pull', (err, stdout) => {
    if (err) return res.status(500).send(err.message);
    res.status(200).send('Deployed');
  });
});

async function getUserFromReq(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
    return await prisma.user.findUnique({ where: { id: decoded.userId } });
  } catch (e) { return null; }
}

async function areFriends(userId1: string, userId2: string) {
  try {
    // @ts-ignore - Временный игнор до полной перегенерации клиента
    const f1 = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userId1, followingId: userId2 } }
    });
    // @ts-ignore
    const f2 = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userId2, followingId: userId1 } }
    });
    return !!f1 && !!f2;
  } catch (e) { return false; }
}

async function canAccess(viewerId: string | undefined, owner: any, privacyField: PrivacyLevel) {
  if (viewerId === owner.id) return true;
  if (privacyField === 'EVERYONE') return true;
  if (privacyField === 'NOBODY') return false;
  if (privacyField === 'FRIENDS') {
    if (!viewerId) return false;
    return await areFriends(viewerId, owner.id);
  }
  return false;
}

// Routes
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { username, password, email } = req.body;
    const user = await prisma.user.create({
      data: {
        username,
        email: email ? encryptField(email) : null,
        password: hashPassword(password),
      },
    });
    res.status(201).json({ token: jwt.sign({ userId: user.id }, config.jwtSecret), user });
  } catch (err) { res.status(400).json({ error: 'User exists' }); }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ token: jwt.sign({ userId: user.id }, config.jwtSecret), user });
});

app.get('/api/auth/me', async (req: Request, res: Response) => {
  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ ...user, bio: decryptField(user.bio) });
});

app.put('/api/auth/profile', async (req: Request, res: Response) => {
  try {
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const allowedFields = ['firstName', 'lastName', 'bio', 'socialLinks', 'birthDate', 'privacyProfile', 'privacyMessages', 'privacyPosts', 'avatar'];
    const data: any = {};
    
    allowedFields.forEach(f => {
      if (req.body[f] !== undefined && req.body[f] !== null) {
        data[f] = f === 'bio' ? encryptField(req.body[f]) : req.body[f];
      }
    });

    const updated = await prisma.user.update({
      where: { id: user.id },
      data
    });
    res.json(updated);
  } catch (e: any) { 
    console.error('Update Profile Error:', e.message);
    res.status(500).json({ error: 'Update failed', details: e.message }); 
  }
});

app.get('/api/users/:username', async (req: Request, res: Response) => {
  try {
    const viewer = await getUserFromReq(req);
    const { username } = req.params;
    const owner = await prisma.user.findUnique({ where: { username } });
    if (!owner) return res.status(404).json({ error: 'Not found' });

    let followersCount = 0;
    let followingCount = 0;
    let isFollowing = false;

    // Безопасный подсчет статистики
    try {
      // @ts-ignore
      followersCount = await prisma.follow.count({ where: { followingId: owner.id } });
      // @ts-ignore
      followingCount = await prisma.follow.count({ where: { followerId: owner.id } });
      
      if (viewer) {
        // @ts-ignore
        const f = await prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: viewer.id, followingId: owner.id } }
        });
        isFollowing = !!f;
      }
    } catch (e) {
      console.error('Stats error:', e);
    }

    const hasAccess = await canAccess(viewer?.id, owner, owner.privacyProfile);
    if (!hasAccess) {
      return res.json({ username: owner.username, avatar: owner.avatar, isRestricted: true, isFollowing, _count: { followers: followersCount, following: followingCount } });
    }

    res.json({ 
      ...owner, 
      bio: decryptField(owner.bio), 
      isFollowing, 
      _count: { followers: followersCount, following: followingCount }, 
      email: undefined, 
      password: undefined 
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/users/:userId/follow', async (req: Request, res: Response) => {
  const viewer = await getUserFromReq(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });
  const { userId } = req.params;
  
  try {
    // @ts-ignore
    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewer.id, followingId: userId } }
    });

    if (existing) {
      // @ts-ignore
      await prisma.follow.delete({ where: { followerId_followingId: { followerId: viewer.id, followingId: userId } } });
      return res.json({ following: false });
    } else {
      // @ts-ignore
      await prisma.follow.create({ data: { followerId: viewer.id, followingId: userId } });
      return res.json({ following: true });
    }
  } catch (e) { res.status(500).json({ error: 'Follow operation failed' }); }
});

app.get('/api/posts', async (req: Request, res: Response) => {
  try {
    const viewer = await getUserFromReq(req);
    const { username } = req.query;
    let where: any = {};
    
    if (username) {
      const owner = await prisma.user.findUnique({ where: { username: username as string } });
      if (!owner || !(await canAccess(viewer?.id, owner, owner.privacyPosts))) return res.json([]);
      where.authorId = owner.id;
    }

    const posts = await prisma.post.findMany({
      where,
      // Временно убираем isPinned до полной синхронизации клиента
      orderBy: [{ createdAt: 'desc' }],
      include: { author: { select: { username: true, firstName: true, avatar: true } }, _count: { select: { likes: true } } }
    });
    res.json(posts);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/posts', async (req: Request, res: Response) => {
  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const post = await prisma.post.create({
    data: { content: req.body.content, authorId: user.id },
    include: { author: { select: { username: true, firstName: true, avatar: true } } }
  });
  res.json(post);
});

app.listen(config.port, '0.0.0.0', () => console.log(`Z API running on port ${config.port}`));