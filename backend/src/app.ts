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

// Helper: Check if two users are friends (mutual follows)
async function areFriends(userId1: string, userId2: string) {
  const follow1 = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: userId1, followingId: userId2 } }
  });
  const follow2 = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: userId2, followingId: userId1 } }
  });
  return !!follow1 && !!follow2;
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
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ token: generateToken(user.id), user });
});

app.get('/api/auth/me', async (req: Request, res: Response) => {
  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({
    ...user,
    bio: decryptField(user.bio),
    privacyProfile: user.privacyProfile,
    privacyMessages: user.privacyMessages,
    privacyPosts: user.privacyPosts
  });
});

app.put('/api/auth/profile', async (req: Request, res: Response) => {
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
});

app.get('/api/users/:username', async (req: Request, res: Response): Promise<any> => {
  const viewer = await getUserFromReq(req);
  const { username } = req.params;
  const owner = await prisma.user.findUnique({
    where: { username },
    include: { _count: { select: { followers: true, following: true } } }
  });

  if (!owner) return res.status(404).json({ error: 'User not found' });

  const hasAccess = await canAccess(viewer?.id, owner, owner.privacyProfile);
  
  if (!hasAccess) {
    return res.json({
      username: owner.username,
      avatar: owner.avatar,
      isRestricted: true,
      _count: owner._count
    });
  }

  res.json({
    ...owner,
    bio: decryptField(owner.bio),
    email: undefined, password: undefined
  });
});

app.get('/api/posts', async (req: Request, res: Response) => {
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
    orderBy: { createdAt: 'desc' }, // Удалено isPinned для стабильности
    include: { author: true, _count: { select: { likes: true } } }
  });

  res.json(posts);
});

app.listen(config.port, '0.0.0.0', () => console.log(`Z API running on port ${config.port}`));