import express, { Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { prisma, initDb } from './prisma';
import { config } from './config';
import { hashPassword, verifyPassword } from './utils/crypto';
import { gitWatcher } from './services/gitWatcher';
import { keyRotation } from './services/keyRotation';
import { clusterService } from './services/clusterService';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

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

// --- AUTH ---
app.post('/api/auth/register', async (req, res) => {
  const { username, password, email, firstName } = req.body;
  try {
    const user = await prisma.user.create({
      data: { username, password: hashPassword(password), email, firstName: firstName || username, nodeId: config.nodeId }
    });
    const token = jwt.sign({ userId: user.id }, config.jwtSecret);
    res.status(201).json({ token, user });
  } catch (e) { res.status(400).json({ error: 'User already exists' }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !verifyPassword(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id }, config.jwtSecret);
    res.json({ token, user });
  } catch (e) { res.status(500).json({ error: 'Login error' }); }
});

app.get('/api/auth/me', authenticate, (req: any, res) => res.json(req.user));

app.get('/api/auth/check-username', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { username: String(req.query.username) } });
  res.json({ available: !user });
});

// --- USERS ---
app.get('/api/users/:username', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { username: req.params.username },
    include: { _count: { select: { posts: true, followers: true, following: true } } }
  });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

app.post('/api/users/update', authenticate, async (req: any, res) => {
  const updated = await prisma.user.update({ where: { id: req.user.id }, data: req.body });
  res.json(updated);
});

app.post('/api/users/:id/follow', authenticate, async (req: any, res) => {
  const targetId = parseInt(req.params.id);
  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: req.user.id, followingId: targetId } }
  });
  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
    return res.json({ following: false });
  }
  await prisma.follow.create({ data: { followerId: req.user.id, followingId: targetId } });
  res.json({ following: true });
});

// --- POSTS ---
app.get('/api/posts', async (req, res) => {
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
  const existing = await prisma.like.findUnique({
    where: { userId_postId: { userId: req.user.id, postId } }
  });
  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    return res.json({ liked: false });
  }
  await prisma.like.create({ data: { userId: req.user.id, postId } });
  res.json({ liked: true });
});

// --- BOOTSTRAP ---
async function bootstrap() {
  console.log('\x1b[32m%s\x1b[0m', '🚀 Инициализация Z-Node...');
  
  // 1. Папки
  ['uploads/avatars', 'uploads/posts'].forEach(f => fs.mkdirSync(path.join(process.cwd(), f), { recursive: true }));

  // 2. БД (Ждем полной готовности перед запуском сервисов)
  await initDb();

  // 3. Сервисы
  gitWatcher.start();
  await keyRotation.start();
  if (!config.isMasterNode) clusterService.registerWithMaster('System');

  app.listen(config.port, '0.0.0.0', () => {
    console.log('\x1b[32m%s\x1b[0m', `✅ Система готова. Порт: ${config.port}`);
  });
}

bootstrap();