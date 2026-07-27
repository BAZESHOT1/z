import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { PrismaClient, PrivacyLevel } from '@prisma/client';
import { config } from './config';
import { hashPassword, verifyPassword, encryptField, decryptField } from './utils/crypto';

const app = express();
export const prisma = new PrismaClient();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Логирование запросов
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

function generateToken(userId: string) {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '30d' });
}

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

async function areFriends(userId1: string, userId2: string) {
  try {
    const f1 = await (prisma as any).follow.findUnique({
      where: { followerId_followingId: { followerId: userId1, followingId: userId2 } }
    });
    const f2 = await (prisma as any).follow.findUnique({
      where: { followerId_followingId: { followerId: userId2, followingId: userId1 } }
    });
    return !!f1 && !!f2;
  } catch (e) {
    return false;
  }
}

async function canAccess(viewerId: string | undefined, owner: any, privacyField: PrivacyLevel) {
  if (viewerId === owner.id) return true;
  if (privacyField === 'EVERYONE') return true;
  if (privacyField === 'NOBODY') return false;
  if (privacyField === 'FRIENDS') {
    if (!viewerId) return false;
    return await areFriends(viewerId, owner.id);
  }
  return false;
}

app.post('/api/auth/register', async (req: Request, res: Response): Promise<any> => {
  try {
    const { username, password, email } = req.body;
    const user = await prisma.user.create({
      data: {
        username,
        email: encryptField(email),
        password: hashPassword(password),
      },
    });
    res.status(201).json({ token: generateToken(user.id), user });
  } catch (err) {
    res.status(400).json({ error: 'Username or email already exists' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response): Promise<any> => {
  try {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ token: generateToken(user.id), user });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/me', async (req: Request, res: Response) => {
  try {
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    res.json({
      ...user,
      bio: decryptField(user.bio),
    });
  } catch (e) {
    res.status(500).json({ error: 'Auth check failed' });
  }
});

app.put('/api/auth/profile', async (req: Request, res: Response) => {
  try {
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { firstName, lastName, bio, privacyProfile, privacyMessages, privacyPosts } = req.body;
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName, lastName, 
        bio: encryptField(bio),
        privacyProfile, privacyMessages, privacyPosts
      }
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Update failed' });
  }
});

app.get('/api/users/:username', async (req: Request, res: Response): Promise<any> => {
  try {
    const viewer = await getUserFromReq(req);
    const { username } = req.params;
    
    const owner = await prisma.user.findUnique({ where: { username } });
    if (!owner) return res.status(404).json({ error: 'User not found' });

    // Безопасный подсчет статистики
    let followersCount = 0;
    let followingCount = 0;
    try {
      followersCount = await (prisma as any).follow.count({ where: { followingId: owner.id } });
      followingCount = await (prisma as any).follow.count({ where: { followerId: owner.id } });
    } catch (e) { console.log('Stats error:', e); }

    const hasAccess = await canAccess(viewer?.id, owner, owner.privacyProfile);
    
    if (!hasAccess) {
      return res.json({
        username: owner.username,
        avatar: owner.avatar,
        isRestricted: true,
        _count: { followers: followersCount, following: followingCount }
      });
    }

    res.json({
      ...owner,
      bio: decryptField(owner.bio),
      _count: { followers: followersCount, following: followingCount },
      email: undefined, password: undefined
    });
  } catch (e) {
    res.status(500).json({ error: 'Profile fetch failed' });
  }
});

app.get('/api/posts', async (req: Request, res: Response) => {
  try {
    const viewer = await getUserFromReq(req);
    const { username } = req.query;

    let whereClause: any = {};
    if (username) {
      const owner = await prisma.user.findUnique({ where: { username: username as string } });
      if (!owner) return res.json([]);
      const hasAccess = await canAccess(viewer?.id, owner, owner.privacyPosts);
      if (!hasAccess) return res.json([]);
      whereClause.authorId = owner.id;
    }

    const posts = await prisma.post.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: { 
        author: {
          select: { id: true, username: true, firstName: true, lastName: true, avatar: true }
        }
      }
    });

    res.json(posts);
  } catch (e) {
    res.status(500).json({ error: 'Posts fetch failed' });
  }
});

// Глобальный обработчик ошибок
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[CRITICAL ERROR]', err);
  res.status(500).json({ error: 'Unexpected server error' });
});

app.listen(config.port, '0.0.0.0', () => console.log(`Z API running on port ${config.port}`));