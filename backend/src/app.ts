import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { encryptField, decryptField, hashPassword, verifyPassword } from './utils/crypto';
import { gitWatcher } from './services/gitWatcher';
import { clusterService } from './services/clusterService';
import { keyRotation } from './services/keyRotation';

const app = express();
export const prisma = new PrismaClient();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Middleware для авторизации
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
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- AUTH API ---

app.get('/api/auth/check-username', async (req: Request, res: Response) => {
  const { username } = req.query;
  const user = await prisma.user.findUnique({ where: { username: String(username) } });
  res.json({ available: !user });
});

app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { username, password, email, firstName } = req.body;
    const encryptedEmail = await encryptField(email);
    
    const user = await prisma.user.create({
      data: {
        username,
        password: hashPassword(password),
        email: encryptedEmail,
        firstName: firstName || username
      }
    });
    res.status(201).json({ token: jwt.sign({ userId: user.id }, config.jwtSecret), user });
  } catch (err) { res.status(400).json({ error: 'User already exists' }); }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  res.json({ token: jwt.sign({ userId: user.id }, config.jwtSecret), user });
});

app.get('/api/auth/me', authenticate, async (req: any, res: Response) => {
  const user = req.user;
  const decryptedBio = await decryptField(user.bio);
  res.json({ ...user, bio: decryptedBio });
});

app.put('/api/auth/profile', authenticate, async (req: any, res: Response) => {
  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: req.body
    });
    res.json(updated);
  } catch (e) { res.status(400).json({ error: 'Update failed' }); }
});

// --- USERS API ---

app.get('/api/users/:username', async (req: Request, res: Response) => {
  const { username } = req.params;
  const user = await prisma.user.findUnique({ 
    where: { username },
    include: {
      _count: { select: { followedBy: true, following: true } }
    }
  });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

app.post('/api/users/:userId/follow', authenticate, async (req: any, res: Response) => {
  const targetId = parseInt(req.params.userId);
  const followerId = req.user.id;

  if (targetId === followerId) return res.status(400).json({ error: 'Self-follow' });

  const existing = await prisma.follows.findUnique({
    where: { followerId_followingId: { followerId, followingId: targetId } }
  });

  if (existing) {
    await prisma.follows.delete({ where: { followerId_followingId: { followerId, followingId: targetId } } });
    return res.json({ following: false });
  } else {
    await prisma.follows.create({ data: { followerId, followingId: targetId } });
    return res.json({ following: true });
  }
});

// --- POSTS API ---

app.get('/api/posts', async (req: Request, res: Response) => {
  const { username } = req.query;
  const posts = await prisma.post.findMany({
    where: username ? { author: { username: String(username) } } : {},
    include: { author: { select: { username: true, firstName: true, avatar: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(posts);
});

app.post('/api/posts', authenticate, async (req: any, res: Response) => {
  const { content } = req.body;
  const post = await prisma.post.create({
    data: { content, authorId: req.user.id },
    include: { author: { select: { username: true, firstName: true, avatar: true } } }
  });
  res.json(post);
});

async function init() {
  gitWatcher.start();
  if (config.isMasterNode) await keyRotation.start();
  else clusterService.sendHeartbeat();

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`🚀 Z-MASTER Node running on port ${config.port}`);
  });
}

init();