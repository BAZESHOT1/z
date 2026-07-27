import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { clusterService } from './services/clusterService';
import { hashPassword, verifyPassword, encryptField, decryptField } from './utils/crypto';

const app = express();
export const prisma = new PrismaClient();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Helper for JWT
function generateToken(userId: string) {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '30d' });
}

// Get user from token
async function getUserFromReq(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
    return await prisma.user.findUnique({ where: { id: decoded.userId } });
  } catch (e) {
    return null;
  }
}

// Auth Middleware for admin access
const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const user = await getUserFromReq(req);
  if (user && (user.role === 'admin' || user.role === 'root')) {
    return next();
  }
  res.status(403).json({ error: 'Доступ ограничен: только для администраторов' });
};

// Check username availability
app.get('/api/auth/check-username', async (req: Request, res: Response): Promise<any> => {
  const { username } = req.query;
  if (!username || typeof username !== 'string') return res.json({ available: false });
  const existing = await prisma.user.findUnique({ where: { username } });
  res.json({ available: !existing });
});

// POST /api/auth/register
app.post('/api/auth/register', async (req: Request, res: Response): Promise<any> => {
  try {
    const { username, password, email } = req.body || {};
    if (!username || !password || !email) {
      return res.status(400).json({ error: 'Пожалуйста, заполните все обязательные поля' });
    }

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) return res.status(400).json({ error: 'Этот логин уже занят' });

    const user = await prisma.user.create({
      data: {
        username,
        email: encryptField(email), // Шифруем email
        password: hashPassword(password),
        role: 'user',
        status: 'online',
        lastSeen: new Date(),
      },
    });

    const token = generateToken(user.id);
    return res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName || user.username, // Fallback to username
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Системная ошибка при регистрации' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req: Request, res: Response): Promise<any> => {
  try {
    const { username, password } = req.body || {};
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Логин или пароль введены неверно' });
    }

    const token = generateToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName || user.username,
        lastName: user.lastName,
        role: user.role,
        bio: decryptField(user.bio),
        avatar: user.avatar,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', async (req: Request, res: Response): Promise<any> => {
  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Авторизация истекла' });
  res.json({
    id: user.id,
    username: user.username,
    firstName: user.firstName || user.username,
    lastName: user.lastName,
    role: user.role,
    bio: decryptField(user.bio),
    avatar: user.avatar,
  });
});

// PUT /api/auth/profile - Обновление профиля
app.put('/api/auth/profile', async (req: Request, res: Response): Promise<any> => {
  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Ошибка доступа' });

  const { firstName, lastName, bio, socialLinks, birthDate, avatar } = req.body;
  
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      firstName: firstName || null,
      lastName: firstName ? (lastName || null) : null, // Фамилия только если есть имя
      bio: encryptField(bio),
      socialLinks: encryptField(socialLinks),
      birthDate: encryptField(birthDate),
      avatar: avatar || user.avatar,
    },
  });

  res.json({ success: true, user: { ...updated, bio: decryptField(updated.bio) } });
});

// PUT /api/auth/role
app.put('/api/auth/role', async (req: Request, res: Response): Promise<any> => {
  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Доступ запрещен' });
  const { role } = req.body;
  await prisma.user.update({ where: { id: user.id }, data: { role } });
  res.json({ success: true, role });
});

// ====== ПОСТЫ =====
app.get('/api/posts', async (req: Request, res: Response) => {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: 'desc' },
    include: { author: true, likes: true },
  });
  const formatted = posts.map(p => ({
    id: p.id,
    content: p.content,
    createdAt: p.createdAt,
    author: {
      name: p.author.firstName || p.author.username,
      username: p.author.username,
      avatar: p.author.avatar,
      role: p.author.role,
    },
    likes: p.likes.length,
  }));
  res.json(formatted);
});

app.post('/api/posts', async (req: Request, res: Response): Promise<any> => {
  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Войдите в сеть для публикации' });
  const { content } = req.body;
  const post = await prisma.post.create({
    data: { content, authorId: user.id },
    include: { author: true },
  });
  res.status(201).json({ ...post, author: { name: post.author.firstName || post.author.username, username: post.author.username, avatar: post.author.avatar } });
});

// ====== CLUSTER (Admin Only) =====
app.get('/api/cluster/nodes', isAdmin, async (req: Request, res: Response) => {
  const status = await clusterService.getClusterStatus();
  res.json(status);
});

app.listen(config.port, '0.0.0.0', () => console.log(`Z API running on port ${config.port}`));