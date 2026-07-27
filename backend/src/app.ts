import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { exec } from 'child_process'; // Добавлено для выполнения системных команд
import crypto from 'crypto';
import { PrismaClient, PrivacyLevel } from '@prisma/client';
import { config } from './config';
import { hashPassword, verifyPassword, encryptField, decryptField } from './utils/crypto';

const app = express();
export const prisma = new PrismaClient();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// --- АВТО-ДЕПЛОЙ (WEBHOOK) ---
// Этот эндпоинт будет вызываться GitHub при пуше
app.post('/api/webhooks/deploy', (req: Request, res: Response) => {
  const signature = req.headers['x-hub-signature-256'];
  const secret = config.jwtSecret; // Используем существующий секрет для простоты или добавь новый в .env

  if (!signature) {
    return res.status(401).send('No signature');
  }

  // Проверка подлинности запроса от GitHub (защита от злоумышленников)
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

  if (signature !== digest) {
    return res.status(401).send('Invalid signature');
  }

  console.log('[Deploy] Получен сигнал от GitHub, начинаю обновление...');

  // Выполняем git pull. 
  // Если ты используешь Docker с монтированием папок (как в твоем docker-compose), 
  // изменения сразу подхватятся.
  exec('git pull', (err, stdout, stderr) => {
    if (err) {
      console.error(`[Deploy Error] ${err}`);
      return res.status(500).send(err.message);
    }
    console.log(`[Deploy Success] ${stdout}`);
    res.status(200).send('Deployed successfully');
  });
});

// Helper for Auth
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

// ... остальной код (areFriends, canAccess, маршруты auth, users, posts) ...

async function areFriends(userId1: string, userId2: string) {
  try {
    const f1 = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userId1, followingId: userId2 } }
    });
    const f2 = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userId2, followingId: userId1 } }
    });
    return !!f1 && !!f2;
  } catch (e) { return false; }
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

app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { username, password, email } = req.body;
    const user = await prisma.user.create({
      data: {
        username,
        email: encryptField(email),
        password: hashPassword(password),
      },
    });
    res.status(201).json({ token: jwt.sign({ userId: user.id }, config.jwtSecret), user });
  } catch (err) { res.status(400).json({ error: 'Username/Email exists' }); }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
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
    const { firstName, lastName, bio, socialLinks, birthDate, privacyProfile, privacyMessages, privacyPosts } = req.body;
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName, lastName,
        bio: encryptField(bio),
        socialLinks, birthDate,
        privacyProfile, privacyMessages, privacyPosts
      }
    });
    res.json(updated);
  } catch (e) { 
    console.error(e);
    res.status(500).json({ error: 'Update failed' }); 
  }
});

app.get('/api/users/:username', async (req: Request, res: Response) => {
  const viewer = await getUserFromReq(req);
  const { username } = req.params;
  const owner = await prisma.user.findUnique({ where: { username } });
  if (!owner) return res.status(404).json({ error: 'User not found' });
  const followersCount = await prisma.follow.count({ where: { followingId: owner.id } });
  const followingCount = await prisma.follow.count({ where: { followerId: owner.id } });
  let isFollowing = false;
  if (viewer) {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewer.id, followingId: owner.id } }
    });
    isFollowing = !!follow;
  }
  const hasAccess = await canAccess(viewer?.id, owner, owner.privacyProfile);
  if (!hasAccess) {
    return res.json({ username: owner.username, avatar: owner.avatar, isRestricted: true, isFollowing, _count: { followers: followersCount, following: followingCount } });
  }
  res.json({ ...owner, bio: decryptField(owner.bio), isFollowing, _count: { followers: followersCount, following: followingCount }, email: undefined, password: undefined });
});

app.post('/api/users/:userId/follow', async (req: Request, res: Response) => {
  const viewer = await getUserFromReq(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });
  const { userId } = req.params;
  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: viewer.id, followingId: userId } }
  });
  if (existing) {
    await prisma.follow.delete({ where: { followerId_followingId: { followerId: viewer.id, followingId: userId } } });
    return res.json({ following: false });
  } else {
    await prisma.follow.create({ data: { followerId: viewer.id, followingId: userId } });
    return res.json({ following: true });
  }
});

app.get('/api/posts', async (req: Request, res: Response) => {
  const viewer = await getUserFromReq(req);
  const { username } = req.query;
  let where: any = {};
  if (username) {
    const owner = await prisma.user.findUnique({ where: { username: username as string } });
    if (!owner || !(await canAccess(viewer?.id, owner, owner.privacyPosts))) return res.json([]);
    where.authorId = owner.id;
  }
  const posts = await prisma.post.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { username: true, firstName: true, lastName: true, avatar: true } }, _count: { select: { likes: true } } }
  });
  res.json(posts);
});

app.post('/api/posts', async (req: Request, res: Response) => {
  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const { content } = req.body;
  const post = await prisma.post.create({
    data: { content, authorId: user.id },
    include: { author: { select: { username: true, firstName: true, lastName: true, avatar: true } } }
  });
  res.json(post);
});

app.listen(config.port, '0.0.0.0', () => console.log(`Z API running on port ${config.port}`));