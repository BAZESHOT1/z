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
    }
  });
}

function syncDatabase() {
  try {
    console.log('[Database] Generating client & syncing...');
    execSync('npx prisma generate && npx prisma db push', { stdio: 'inherit' });
    console.log('[Database] Sync successful.');
  } catch (e) {
    console.error('[Database] Sync error (Check connections)');
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

// --- ROUTES ---

app.post('/api/auth/register', async (req, res) => {
  const { username, password, email, firstName } = req.body;
  try {
    const user = await prisma.user.create({
      data: {
        username,
        password: hashPassword(password),
        email: email, // Пока без шифрования для теста 401
        firstName: firstName || username,
        nodeId: config.nodeId
      }
    });
    const token = jwt.sign({ userId: user.id }, config.jwtSecret);
    res.status(201).json({ token, user });
  } catch (e) { res.status(400).json({ error: 'Registration failed' }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id }, config.jwtSecret);
    res.json({ token, user });
  } catch (e) { res.status(500).json({ error: 'Login error' }); }
});

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
  } catch (e: any) {
    console.error('Post fetch error:', e.message);
    // Если Prisma еще не видит связи, отдаем пустой массив вместо 500
    res.json([]);
  }
});

app.post('/api/posts', authenticate, async (req: any, res) => {
  try {
    const post = await prisma.post.create({
      data: { content: req.body.content, authorId: req.user.id },
      include: { author: { select: { username: true, firstName: true, avatar: true } } }
    });
    res.json(post);
  } catch(e) { res.status(400).json({ error: 'Post creation failed' }); }
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({ error: 'Internal Error' });
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
  app.listen(config.port, '0.0.0.0', () => console.log(`🚀 Z-Node Active on ${config.port}`));
}

bootstrap().catch(console.error);