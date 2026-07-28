import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { encryptField, decryptField, hashPassword, verifyPassword } from './utils/crypto';
import { gitWatcher } from './services/gitWatcher';
import { keyRotation } from './services/keyRotation';

const app = express();
export const prisma = new PrismaClient();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

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

// --- AUTH ---
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { username, password, email, firstName } = req.body;
  try {
    const user = await prisma.user.create({
      data: {
        username,
        password: hashPassword(password),
        email: await encryptField(email),
        firstName: firstName || username
      }
    });
    const token = jwt.sign({ userId: user.id }, config.jwtSecret);
    res.status(201).json({ token, user });
  } catch (e) { res.status(400).json({ error: 'Username taken' }); }
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

app.get('/api/auth/me', authenticate, async (req: any, res: Response) => {
  res.json(req.user);
});

// --- CLUSTER (Для связи с Community узлами) ---
app.post('/api/cluster/register', async (req: Request, res: Response) => {
  const { nodeId, url, owner, secret } = req.body;
  if (secret !== config.clusterSecret) return res.status(403).json({ error: 'Wrong cluster secret' });

  const node = await prisma.clusterNode.upsert({
    where: { id: nodeId },
    update: { url, lastSeen: new Date(), status: 'active' },
    create: { id: nodeId, url, owner, status: 'active' }
  });
  res.json({ status: 'registered', node });
});

app.post('/api/cluster/heartbeat', async (req: Request, res: Response) => {
  const { nodeId } = req.body;
  await prisma.clusterNode.update({
    where: { id: nodeId },
    data: { lastSeen: new Date(), status: 'active' }
  });
  res.json({ ok: true });
});

// --- POSTS ---
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
  const post = await prisma.post.create({
    data: { content: req.body.content, authorId: req.user.id },
    include: { author: { select: { username: true, firstName: true, avatar: true } } }
  });
  res.json(post);
});

async function init() {
  gitWatcher.start();
  await keyRotation.start();
  app.listen(config.port, '0.0.0.0', () => console.log(`🚀 MASTER Node: ${config.port}`));
}
init();