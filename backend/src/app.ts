import express, { Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

import { prisma } from './prisma';
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
      data: { username, password: hashPassword(password), email, firstName: firstName || username, nodeId: config.nodeId }
    });
    const token = jwt.sign({ userId: user.id }, config.jwtSecret);
    res.status(201).json({ token, user });
  } catch (e: any) { 
    console.error('Register error:', e.message);
    res.status(400).json({ error: 'Ошибка при регистрации' }); 
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

// --- POSTS ---
app.get('/api/posts', async (req, res) => {
  const { username } = req.query;
  try {
    // Безопасное получение постов с фоллбэком
    const posts = await prisma.post.findMany({
      where: username ? { author: { username: String(username) } } : {},
      include: { 
        author: { select: { username: true, firstName: true, avatar: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    
    // Форматируем структуру с дефолтными счетчиками
    const formatted = posts.map(p => ({
      ...p,
      _count: { likes: 0, comments: 0 }
    }));

    res.json(formatted);
  } catch (e: any) {
    console.error('Fetch posts error:', e.message);
    res.json([]);
  }
});

app.post('/api/posts', authenticate, async (req: any, res) => {
  try {
    const post = await prisma.post.create({
      data: { content: req.body.content, authorId: req.user.id },
      include: { author: { select: { username: true, firstName: true, avatar: true } } }
    });
    res.json({ ...post, _count: { likes: 0, comments: 0 } });
  } catch (e: any) {
    res.status(400).json({ error: 'Не удалось создать пост' });
  }
});

// --- BOOTSTRAP ---
async function bootstrap() {
  console.log('🚀 Инициализация систем Z-Node...');

  ['uploads', 'uploads/avatars', 'uploads/posts'].forEach(f => {
    if (!fs.existsSync(path.join(process.cwd(), f))) {
      fs.mkdirSync(path.join(process.cwd(), f), { recursive: true });
    }
  });

  gitWatcher.start();
  await keyRotation.start();
  if (!config.isMasterNode) clusterService.registerWithMaster('System');

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`✅ Сервер успешно запущен на порту ${config.port}`);
  });
}

bootstrap();