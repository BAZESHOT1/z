import express, { Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

// Сначала импортируем initDb и prisma
import { prisma, initDb } from './prisma';
import { config } from './config';
import { hashPassword, verifyPassword } from './utils/crypto';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// МИДДЛВАР — теперь использует prisma, которая будет инициализирована к моменту запроса
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
    const user = await prisma.user.create({
      data: { username, password: hashPassword(password), email, firstName: firstName || username, nodeId: config.nodeId }
    });
    const token = jwt.sign({ userId: user.id }, config.jwtSecret);
    res.status(201).json({ token, user });
  } catch (e) { res.status(400).json({ error: 'Registration error' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
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

// --- POSTS ---
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
  } catch (e) { res.json([]); }
});

// --- BOOTSTRAP ---
async function bootstrap() {
  console.log('🚀 Инициализация систем Z-Node...');
  
  // 1. Сначала БД (Критично!)
  await initDb();

  // 2. Только ПОСЛЕ БД импортируем и запускаем сервисы
  const { gitWatcher } = await import('./services/gitWatcher');
  const { keyRotation } = await import('./services/keyRotation');
  const { clusterService } = await import('./services/clusterService');

  // 3. Папки
  ['uploads/avatars', 'uploads/posts'].forEach(f => fs.mkdirSync(path.join(process.cwd(), f), { recursive: true }));

  gitWatcher.start();
  await keyRotation.start();
  if (!config.isMasterNode) clusterService.registerWithMaster('System');

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`✅ Сервер запущен на порту ${config.port}`);
  });
}

bootstrap();