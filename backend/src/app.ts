import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { encryptField, hashPassword, verifyPassword } from './utils/crypto';
import { gitWatcher } from './services/gitWatcher';
import { keyRotation } from './services/keyRotation';
import { clusterService } from './services/clusterService';

const app = express();
export const prisma = new PrismaClient();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// --- СИСТЕМНЫЕ ИНИЦИАЛИЗАЦИИ ---

function ensureStorageBuckets() {
  const folders = ['uploads', 'uploads/avatars', 'uploads/posts', 'uploads/media'];
  folders.forEach(folder => {
    const fullPath = path.join(process.cwd(), folder);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`[Storage] Created bucket: ${folder}`);
    }
  });
}

function syncDatabase() {
  try {
    console.log('[Database] Syncing schema...');
    // npx prisma db push обновляет структуру без удаления данных (если нет конфликтов)
    execSync('npx prisma db push', { stdio: 'inherit' });
    console.log('[Database] Schema is up to date.');
  } catch (e) {
    console.error('[Database] Sync failed. Check schema for breaking changes.');
  }
}

// --- AUTH MIDDLEWARE ---

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

// --- API ROUTES ---

// Auth
app.get('/api/auth/check-username', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { username: String(req.query.username) } });
  res.json({ available: !user });
});

app.post('/api/auth/register', async (req, res) => {
  const { username, password, email, firstName } = req.body;
  try {
    const user = await prisma.user.create({
      data: {
        username,
        password: hashPassword(password),
        email: await encryptField(email),
        firstName: firstName || username,
        nodeId: config.nodeId
      }
    });
    const token = jwt.sign({ userId: user.id }, config.jwtSecret);
    res.status(201).json({ token, user });
  } catch (e) { res.status(400).json({ error: 'User registration failed' }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ userId: user.id }, config.jwtSecret);
  res.json({ token, user });
});

app.get('/api/auth/me', authenticate, (req: any, res) => res.json(req.user));

// Posts & Feed
app.get('/api/posts', async (req, res) => {
  try {
    const { username } = req.query;
    const posts = await prisma.post.findMany({
      where: username ? { author: { username: String(username) } } : {},
      include: { 
        author: { select: { username: true, firstName: true, avatar: true } },
        _count: { select: { likes: true, comments: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(posts);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

app.post('/api/posts', authenticate, async (req: any, res) => {
  const post = await prisma.post.create({
    data: { content: req.body.content, authorId: req.user.id },
    include: { author: { select: { username: true, firstName: true, avatar: true } } }
  });
  res.json(post);
});

app.post('/api/posts/:id/like', authenticate, async (req: any, res) => {
  const postId = parseInt(req.params.id);
  const userId = req.user.id;
  try {
    const existing = await (prisma as any).like.findUnique({ where: { userId_postId: { userId, postId } } });
    if (existing) {
      await (prisma as any).like.delete({ where: { userId_postId: { userId, postId } } });
      return res.json({ liked: false });
    }
    await (prisma as any).like.create({ data: { userId, postId } });
    res.json({ liked: true });
  } catch (e) { res.status(400).json({ error: 'Like failed' }); }
});

// Clusters
app.get('/api/cluster/nodes', async (req, res) => {
  const nodes = await (prisma as any).clusterNode.findMany({ where: { status: 'active' } });
  res.json(nodes);
});

// Глобальная обработка ошибок для предотвращения CONNECTION_RESET
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Error Handled]:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

async function bootstrap() {
  ensureStorageBuckets();
  syncDatabase();
  
  gitWatcher.start();
  await keyRotation.start();
  
  if (!config.isMasterNode) {
    await clusterService.registerWithMaster('System');
    clusterService.sendHeartbeat();
  }
  
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`🚀 Z-Node [${config.isMasterNode ? 'MASTER' : 'COMMUNITY'}] Active on ${config.port}`);
  });
}

bootstrap().catch(err => {
  console.error('Critical Bootstrap Error:', err);
  process.exit(1);
});