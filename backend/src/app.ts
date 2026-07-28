import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { hashPassword, verifyPassword } from './utils/crypto';
import { gitWatcher } from './services/gitWatcher';
import { keyRotation } from './services/keyRotation';
import { clusterService } from './services/clusterService';

let prisma: PrismaClient;

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// --- СИСТЕМНЫЕ ИНИЦИАЛИЗАЦИИ ---

function ensureStorageBuckets() {
  console.log('\x1b[36m%s\x1b[0m', '[SYSTEM] 📂 Проверка структуры хранилища...');
  const folders = ['uploads', 'uploads/avatars', 'uploads/posts', 'uploads/media'];
  folders.forEach(folder => {
    const fullPath = path.join(process.cwd(), folder);
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
  });
}

function syncDatabase() {
  console.log('\x1b[35m%s\x1b[0m', '[DATABASE] 🔄 Синхронизация структуры БД...');
  try {
    // Явно генерируем клиент и пушим схему
    execSync('npx prisma generate', { stdio: 'inherit' });
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
    console.log('  └─ ✅ База данных успешно синхронизирована.');
  } catch (e: any) {
    console.error('  └─ ❌ Ошибка синхронизации БД:', e.message);
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

// --- AUTH ROUTES ---

app.get('/api/auth/me', authenticate, (req: any, res) => {
  res.json(req.user);
});

app.get('/api/auth/check-username', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'Username is required' });
  try {
    const user = await prisma.user.findUnique({ where: { username: String(username) } });
    res.json({ available: !user });
  } catch (e) { res.status(500).json({ error: 'Check failed' }); }
});

app.post('/api/auth/register', async (req, res) => {
  const { username, password, email, firstName } = req.body;
  try {
    const user = await prisma.user.create({
      data: {
        username,
        password: hashPassword(password),
        email: email,
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

// --- USER & POST ROUTES ---

app.get('/api/users/:username', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      include: { _count: { select: { posts: true, likes: true } } }
    });
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (e) { res.status(500).json({ error: 'Fetch failed' }); }
});

app.get('/api/posts', async (req, res) => {
  try {
    const { username } = req.query;
    // Безопасная выборка: если _count еще не готов в клиенте, пробуем без него
    try {
      const posts = await prisma.post.findMany({
        where: username ? { author: { username: String(username) } } : {},
        include: { 
          author: { select: { username: true, firstName: true, avatar: true } },
          _count: { select: { likes: true, comments: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });
      return res.json(posts);
    } catch (innerErr) {
       const fallback = await prisma.post.findMany({
         where: username ? { author: { username: String(username) } } : {},
         include: { author: { select: { username: true, firstName: true, avatar: true } } },
         orderBy: { createdAt: 'desc' },
         take: 50
       });
       return res.json(fallback);
    }
  } catch (e: any) { res.json([]); }
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

async function bootstrap() {
  console.log('\n\x1b[32m%s\x1b[0m', '══════════════════════════════════════════════');
  console.log('\x1b[32m%s\x1b[0m', `  🚀 Z-NODE [${config.isMasterNode ? 'MASTER' : 'COMMUNITY'}] ЗАПУСКАЕТСЯ...`);
  console.log('\x1b[32m%s\x1b[0m', '══════════════════════════════════════════════\n');

  ensureStorageBuckets();
  syncDatabase();
  
  console.log('\x1b[36m%s\x1b[0m', '[SYSTEM] 🔌 Инициализация Prisma Client...');
  prisma = new PrismaClient();
  
  gitWatcher.start();
  await keyRotation.start();
  
  if (!config.isMasterNode) {
    await clusterService.registerWithMaster('System');
    clusterService.sendHeartbeat();
  }
  
  console.log('\n\x1b[32m%s\x1b[0m', `✅ ВСЕ СИСТЕМЫ ГОТОВЫ. ПОРТ: ${config.port}\n`);
  app.listen(config.port, '0.0.0.0');
}

bootstrap().catch(err => {
  console.error('\x1b[31m%s\x1b[0m', '❌ КРИТИЧЕСКАЯ ОШИБКА ПРИ ЗАПУСКЕ:', err);
  process.exit(1);
});

export { prisma };