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

let prisma: PrismaClient;

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// --- СИСТЕМНЫЕ ИНИЦИАЛИЗАЦИИ ---

function ensureStorageBuckets() {
  console.log('\x1b[36m%s\x1b[0m', '[SYSTEM] 📂 Проверка структуры хранилища...');
  const folders = ['uploads', 'uploads/avatars', 'uploads/posts', 'uploads/media'];
  let createdCount = 0;
  
  folders.forEach(folder => {
    const fullPath = path.join(process.cwd(), folder);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`  └─ ✨ Создан новый бакет: ${folder}`);
      createdCount++;
    }
  });
  
  if (createdCount === 0) {
    console.log('  └─ ✅ Все папки на месте.');
  }
}

function syncDatabase() {
  console.log('\x1b[35m%s\x1b[0m', '[DATABASE] 🔄 Синхронизация структуры БД...');
  try {
    console.log('  ├─ 🛠️  Генерация Prisma Client...');
    execSync('npx prisma generate', { stdio: 'pipe' });
    
    console.log('  ├─ 📦 Обновление схемы данных (Safe Push)...');
    execSync('npx prisma db push --skip-generate', { stdio: 'pipe' });
    
    console.log('  └─ ✅ База данных успешно синхронизирована.');
  } catch (e: any) {
    console.error('\x1b[31m%s\x1b[0m', '  └─ ❌ Ошибка синхронизации БД!');
    console.error(`     Детали: ${e.message}`);
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
        email: email,
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
    console.error('[API] Ошибка загрузки постов:', e.message);
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

async function bootstrap() {
  console.log('\n\x1b[32m%s\x1b[0m', '══════════════════════════════════════════════');
  console.log('\x1b[32m%s\x1b[0m', `  🚀 Z-NODE [${config.isMasterNode ? 'MASTER' : 'COMMUNITY'}] ЗАПУСКАЕТСЯ...`);
  console.log('\x1b[32m%s\x1b[0m', '══════════════════════════════════════════════\n');

  ensureStorageBuckets();
  syncDatabase();
  
  console.log('\x1b[36m%s\x1b[0m', '[SYSTEM] 🔌 Инициализация Prisma Client...');
  prisma = new PrismaClient();
  
  console.log('\x1b[36m%s\x1b[0m', '[SERVICES] 🛰️  Запуск фоновых служб...');
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
  console.error('\n\x1b[31m%s\x1b[0m', '❌ КРИТИЧЕСКАЯ ОШИБКА ПРИ ЗАПУСКЕ:');
  console.error(err);
  process.exit(1);
});

export { prisma };