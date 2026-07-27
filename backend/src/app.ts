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

// Логирование для отладки
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

async function getUserFromReq(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
    return await prisma.user.findUnique({ where: { id: decoded.userId } });
  } catch (e) { return null; }
}

async function areFriends(userId1: string, userId2: string) {
  try {
    const p = prisma as any;
    const f1 = await p.follow.findUnique({ where: { followerId_followingId: { followerId: userId1, followingId: userId2 } } });
    const f2 = await p.follow.findUnique({ where: { followerId_followingId: { followerId: userId2, followingId: userId1 } } });
    return !!f1 && !!f2;
  } catch (e) { return false; }
}

async function canAccess(viewerId: string | undefined, owner: any, privacyField: PrivacyLevel) {
  if (viewerId === owner.id) return true;
  if (!privacyField || privacyField === 'EVERYONE') return true;
  if (privacyField === 'NOBODY') return false;
  if (privacyField === 'FRIENDS') {
    if (!viewerId) return false;
    return await areFriends(viewerId, owner.id);
  }
  return false;
}

app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { username, password, email } = req.body;
    const user = await prisma.user.create({
      data: { username, email: email ? encryptField(email) : null, password: hashPassword(password) },
    });
    res.status(201).json({ token: jwt.sign({ userId: user.id }, config.jwtSecret), user });
  } catch (err) { res.status(400).json({ error: 'User exists' }); }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !verifyPassword(password, user.password)) return res.status(401).json({ error: 'Invalid' });
  res.json({ token: jwt.sign({ userId: user.id }, config.jwtSecret), user });
});

app.get('/api/auth/me', async (req: Request, res: Response) => {
  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ ...user, bio: decryptField(user.bio) });
});

app.put('/api/auth/profile', async (req: Request, res: Response) => {
  try {
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const body = req.body;
    const updateData: any = {};
    const fields = ['firstName', 'lastName', 'bio', 'avatar', 'socialLinks', 'birthDate', 'privacyProfile', 'privacyMessages', 'privacyPosts'];
    
    fields.forEach(f => {
      if (body[f] !== undefined) {
        updateData[f] = (f === 'bio') ? encryptField(body[f]) : body[f];
      }
    });

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });

    res.json({ ...updated, bio: decryptField(updated.bio) });
  } catch (e: any) { 
    console.error('Update Error:', e.message);
    res.status(500).json({ error: e.message }); 
  }
});

app.get('/api/users/:username', async (req: Request, res: Response) => {
  try {
    const viewer = await getUserFromReq(req);
    const { username } = req.params;
    const owner = await prisma.user.findUnique({ where: { username } });
    if (!owner) return res.status(404).json({ error: 'Not found' });

    let stats = { followers: 0, following: 0 };
    let isFollowing = false;
    
    stats.followers = await prisma.follow.count({ where: { followingId: owner.id } });
    stats.following = await prisma.follow.count({ where: { followerId: owner.id } });
    
    if (viewer) {
      const f = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewer.id, followingId: owner.id } } });
      isFollowing = !!f;
    }

    const privacy = owner.privacyProfile || 'EVERYONE';
    const hasAccess = await canAccess(viewer?.id, owner, privacy as PrivacyLevel);
    
    if (!hasAccess) return res.json({ username: owner.username, avatar: owner.avatar, isRestricted: true, isFollowing, _count: stats });
    res.json({ ...owner, bio: decryptField(owner.bio), isFollowing, _count: stats, email: undefined, password: undefined });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/:userId/follow', async (req: Request, res: Response) => {
  const viewer = await getUserFromReq(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const where = { followerId_followingId: { followerId: viewer.id, followingId: req.params.userId } };
    const existing = await prisma.follow.findUnique({ where });
    if (existing) {
      await prisma.follow.delete({ where });
      return res.json({ following: false });
    } else {
      await prisma.follow.create({ data: { followerId: viewer.id, followingId: req.params.userId } });
      return res.json({ following: true });
    }
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/posts', async (req: Request, res: Response) => {
  try {
    const viewer = await getUserFromReq(req);
    const { username } = req.query;
    let where: any = {};
    
    if (username) {
      const owner = await prisma.user.findUnique({ where: { username: username as string } });
      const privacy = owner?.privacyPosts || 'EVERYONE';
      if (!owner || !(await canAccess(viewer?.id, owner, privacy as PrivacyLevel))) return res.json([]);
      where.authorId = owner.id;
    }

    const posts = await prisma.post.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: { author: { select: { username: true, firstName: true, avatar: true } }, _count: { select: { likes: true } } }
    });
    res.json(posts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts', async (req: Request, res: Response) => {
  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const post = await prisma.post.create({
    data: { content: req.body.content, authorId: user.id },
    include: { author: { select: { username: true, firstName: true, avatar: true } } }
  });
  res.json(post);
});

app.listen(config.port, '0.0.0.0', () => console.log(`Z API running on port ${config.port}`));