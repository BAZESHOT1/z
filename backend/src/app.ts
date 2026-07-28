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
app.use(express.json({ limit: '10mb' }));

// Хранилище фолбека для подписок если таблицы Follows нет в БД
const inMemoryFollows = new Set<string>(); // "followerUsername:followingUsername"

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

const optionalAuth = async (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      req.user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    } catch (e) {}
  }
  next();
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
      data: { 
        username, 
        password: hashPassword(password), 
        email, 
        firstName: firstName || username 
      }
    });
    const token = jwt.sign({ userId: user.id }, config.jwtSecret);
    res.status(201).json({ token, user });
  } catch (e: any) { 
    console.error('Register error:', e.message);
    res.status(400).json({ error: 'Ошибка при регистрации: ' + e.message }); 
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

// --- MEDIA UPLOAD ---
app.post('/api/upload', authenticate, (req, res) => {
  try {
    const { file } = req.body;
    if (!file) return res.status(400).json({ error: 'Файл не передать' });
    
    // Если это base64 data URL
    if (file.startsWith('data:image')) {
      const filename = `img_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.png`;
      const base64Data = file.replace(/^data:image\/\w+;base64,/, "");
      const uploadPath = path.join(process.cwd(), 'uploads', filename);
      fs.writeFileSync(uploadPath, base64Data, 'base64');
      return res.json({ url: `${config.masterNodeUrl || 'http://82.26.152.225:4000'}/uploads/${filename}`, base64: file });
    }

    res.json({ url: file, base64: file });
  } catch (e: any) {
    res.status(500).json({ error: 'Ошибка при сохранении изображения' });
  }
});

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// --- USERS & FOLLOWS ---
app.get('/api/users/:username', optionalAuth, async (req: any, res) => {
  try {
    const targetUsername = req.params.username;
    const user = await prisma.user.findUnique({
      where: { username: targetUsername }
    });
    if (!user) return res.status(404).json({ error: 'Not found' });

    // Считаем подписчиков и подписки
    let followersCount = 0;
    let followingCount = 0;
    for (const key of inMemoryFollows) {
      const [follower, following] = key.split(':');
      if (following === targetUsername) followersCount++;
      if (follower === targetUsername) followingCount++;
    }

    const isFollowing = req.user ? inMemoryFollows.has(`${req.user.username}:${targetUsername}`) : false;

    res.json({ 
      ...user, 
      isFollowing,
      _count: { posts: 0, followers: followersCount, following: followingCount } 
    });
  } catch (e) {
    res.status(500).json({ error: 'Error fetching profile' });
  }
});

app.post('/api/users/update', authenticate, async (req: any, res) => {
  try {
    const { firstName, lastName, bio, avatar, socialLinks } = req.body;
    const updated = await prisma.user.update({ 
      where: { id: req.user.id }, 
      data: { firstName, lastName, bio, avatar, socialLinks } 
    });
    res.json(updated);
  } catch (e: any) {
    console.error('Update profile error:', e.message);
    res.status(400).json({ error: 'Update failed' });
  }
});

app.post('/api/users/:username/follow', authenticate, async (req: any, res) => {
  try {
    const follower = req.user.username;
    const target = req.params.username;

    if (follower === target) {
      return res.status(400).json({ error: 'Нельзя подписаться на самого себя' });
    }

    const key = `${follower}:${target}`;
    let following = false;

    if (inMemoryFollows.has(key)) {
      inMemoryFollows.delete(key);
      following = false;
    } else {
      inMemoryFollows.add(key);
      following = true;
    }

    res.json({ following, username: target });
  } catch (e: any) {
    res.status(500).json({ error: 'Follow operation failed' });
  }
});

app.get('/api/users/:username/followers', async (req, res) => {
  try {
    const target = req.params.username;
    const followerUsernames: string[] = [];

    for (const key of inMemoryFollows) {
      const [follower, following] = key.split(':');
      if (following === target) followerUsernames.push(follower);
    }

    const users = await prisma.user.findMany({
      where: { username: { in: followerUsernames } },
      select: { id: true, username: true, firstName: true, lastName: true, avatar: true, bio: true }
    });

    res.json(users);
  } catch (e) {
    res.json([]);
  }
});

app.get('/api/users/:username/following', async (req, res) => {
  try {
    const target = req.params.username;
    const followingUsernames: string[] = [];

    for (const key of inMemoryFollows) {
      const [follower, following] = key.split(':');
      if (follower === target) followingUsernames.push(following);
    }

    const users = await prisma.user.findMany({
      where: { username: { in: followingUsernames } },
      select: { id: true, username: true, firstName: true, lastName: true, avatar: true, bio: true }
    });

    res.json(users);
  } catch (e) {
    res.json([]);
  }
});

// --- POSTS ---
app.get('/api/posts', async (req, res) => {
  const { username } = req.query;
  try {
    const posts = await prisma.post.findMany({
      where: username ? { author: { username: String(username) } } : {},
      include: { 
        author: { select: { username: true, firstName: true, avatar: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    
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