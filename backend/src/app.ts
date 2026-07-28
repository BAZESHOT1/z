import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { encryptField, decryptField, hashPassword, verifyPassword } from './utils/crypto';
import { gitWatcher } from './services/gitWatcher';
import { keyRotation } from './services/keyRotation';
import { clusterService } from './services/clusterService';

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

// --- AUTH & PROFILE ---

app.get('/api/auth/check-username', async (req: Request, res: Response) => {
  const { username } = req.query;
  const user = await prisma.user.findUnique({ where: { username: String(username) } });
  res.json({ available: !user });
});

app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { username, password, email, firstName } = req.body;
  try {
    const user = await prisma.user.create({
      data: {
        username,
        password: hashPassword(password),
        email: await encryptField(email),
        firstName: firstName || username,
        nodeId: config.nodeId // Привязка пользователя к узлу
      }
    });
    const token = jwt.sign({ userId: user.id }, config.jwtSecret);
    res.status(201).json({ token, user });
  } catch (e) { res.status(400).json({ error: 'Registration failed' }); }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ userId: user.id }, config.jwtSecret);
  res.json({ token, user });
});

app.get('/api/auth/me', authenticate, (req: any, res: Response) => res.json(req.user));

app.put('/api/auth/profile', authenticate, async (req: any, res: Response) => {
  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: req.body
    });
    res.json(updated);
  } catch (e) { res.status(400).json({ error: 'Update failed' }); }
});

// --- SOCIAL API ---

app.get('/api/users/:username', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { username: req.params.username },
    include: { _count: { select: { followedBy: true, following: true } } }
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.post('/api/users/:userId/follow', authenticate, async (req: any, res: Response) => {
  const targetId = parseInt(req.params.userId);
  const followerId = req.user.id;
  try {
    const existing = await (prisma as any).follows.findUnique({
      where: { followerId_followingId: { followerId, followingId: targetId } }
    });
    if (existing) {
      await (prisma as any).follows.delete({ where: { followerId_followingId: { followerId, followingId: targetId } } });
      res.json({ following: false });
    } else {
      await (prisma as any).follows.create({ data: { followerId, followingId: targetId } });
      res.json({ following: true });
    }
  } catch (e) { res.status(400).json({ error: 'Action failed' }); }
});

// --- CONTENT API ---

app.get('/api/posts', async (req: Request, res: Response) => {
  const { username } = req.query;
  const posts = await prisma.post.findMany({
    where: username ? { author: { username: String(username) } } : {},
    include: { author: { select: { username: true, firstName: true, avatar: true } }, _count: { select: { likes: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  res.json(posts);
});

app.post('/api/posts', authenticate, async (req: any, res: Response) => {
  const post = await prisma.post.create({
    data: { content: req.body.content, authorId: req.user.id },
    include: { author: { select: { username: true, firstName: true, avatar: true } } }
  });
  res.json(post);
});

// --- CLUSTER MESH ---

app.post('/api/cluster/register', async (req: Request, res: Response) => {
  if (!config.isMasterNode) return res.status(403).json({ error: 'Only Master accepts registrations' });
  const { nodeId, url, secret } = req.body;
  if (secret !== config.clusterSecret) return res.status(403).json({ error: 'Forbidden' });
  
  const node = await prisma.clusterNode.upsert({
    where: { id: nodeId },
    update: { url, lastSeen: new Date(), status: 'active' },
    create: { id: nodeId, url, status: 'active' }
  });
  res.json({ status: 'ok', node });
});

app.post('/api/cluster/heartbeat', async (req: Request, res: Response) => {
  if (!config.isMasterNode) return res.status(403).json({ error: 'Only Master' });
  await prisma.clusterNode.update({ where: { id: req.body.nodeId }, data: { lastSeen: new Date(), status: 'active' } });
  res.json({ ok: true });
});

async function bootstrap() {
  gitWatcher.start();
  await keyRotation.start();
  
  if (!config.isMasterNode) {
    await clusterService.registerWithMaster('System');
    clusterService.sendHeartbeat();
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`🚀 Z-Node [${config.isMasterNode ? 'MASTER' : 'COMMUNITY'}] running on port ${config.port}`);
  });
}

bootstrap().catch(console.error);