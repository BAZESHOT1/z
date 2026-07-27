import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { clusterService } from './services/clusterService';
import { hashPassword, verifyPassword, encryptField, decryptField } from './utils/crypto';

const app = express();
export const prisma = new PrismaClient();

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  })
);

app.use(express.json());

// Логирование входящих запросов
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.url} | Origin: ${req.headers.origin || 'N/A'}`);
  next();
});

// Вспомогательная функция генерирования JWT токена
function generateToken(userId: string) {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '30d' });
}

// Извлечение текущего пользователя из JWT токена
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

// Инициализация дефолтного администратора
async function initDefaultUser() {
  try {
    const existingUser = await prisma.user.findUnique({ where: { username: 'master_admin' } });
    if (!existingUser) {
      await prisma.user.create({
        data: {
          username: 'master_admin',
          password: hashPassword('admin123'),
          firstName: 'Администратор',
          lastName: 'Z',
          role: 'root',
          status: 'online',
          bio: encryptField('Главный администратор центрального узла сети Z'),
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
        },
      });
      console.log('[Database] Создан дефолтный пользователь master_admin (Role: root, Pass: admin123)');
    }
  } catch (err) {
    console.error('[Database] Ошибка проверки/создания дефолтного пользователя:', err);
  }
}

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'Z API',
    nodeId: config.nodeId,
    isMaster: config.isMasterNode,
    timestamp: new Date().toISOString(),
  });
});

// ====== АВТОРИЗАЦИЯ И РЕГИСТРАЦИЯ ======

// POST /api/auth/register — Регистрация нового пользователя
app.post('/api/auth/register', async (req: Request, res: Response): Promise<any> => {
  try {
    const { username, password, firstName, lastName, bio, socialLinks, birthDate, avatar } = req.body || {};

    if (!username || !password || !firstName) {
      return res.status(400).json({ error: 'Логин, пароль и имя обязательны для заполнения' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Логин должен быть не менее 3 символов' });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
    }

    const encryptedBio = bio ? encryptField(bio.slice(0, 256)) : null;
    const encryptedLinks = socialLinks ? encryptField(typeof socialLinks === 'string' ? socialLinks : JSON.stringify(socialLinks)) : null;
    const encryptedBirthDate = birthDate ? encryptField(birthDate) : null;

    const user = await prisma.user.create({
      data: {
        username,
        password: hashPassword(password),
        firstName,
        lastName: lastName || null,
        role: 'user',
        status: 'online',
        bio: encryptedBio,
        socialLinks: encryptedLinks,
        birthDate: encryptedBirthDate,
        avatar: avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
        lastSeen: new Date(),
      },
    });

    const token = generateToken(user.id);

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        bio: decryptField(user.bio),
        socialLinks: decryptField(user.socialLinks),
        birthDate: decryptField(user.birthDate),
        avatar: user.avatar,
        lastSeen: user.lastSeen,
      },
    });
  } catch (err) {
    console.error('Ошибка регистрации:', err);
    return res.status(500).json({ error: 'Не удалось зарегистрировать пользователя' });
  }
});

// POST /api/auth/login — Вход
app.post('/api/auth/login', async (req: Request, res: Response): Promise<any> => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Введите логин и пароль' });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { status: 'online', lastSeen: new Date() },
    });

    const token = generateToken(user.id);

    return res.json({
      token,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        status: updatedUser.status,
        bio: decryptField(updatedUser.bio),
        socialLinks: decryptField(updatedUser.socialLinks),
        birthDate: decryptField(updatedUser.birthDate),
        avatar: updatedUser.avatar,
        lastSeen: updatedUser.lastSeen,
      },
    });
  } catch (err) {
    console.error('Ошибка входа:', err);
    return res.status(500).json({ error: 'Ошибка входа в систему' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', async (req: Request, res: Response): Promise<any> => {
  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });

  res.json({
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
    bio: decryptField(user.bio),
    socialLinks: decryptField(user.socialLinks),
    birthDate: decryptField(user.birthDate),
    avatar: user.avatar,
    lastSeen: user.lastSeen,
  });
});

// PUT /api/auth/role — Ручка для смены роли
app.put('/api/auth/role', async (req: Request, res: Response): Promise<any> => {
  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });

  const { role } = req.body || {};
  const validRoles = ['user', 'root', 'admin', 'moderator', 'tester', 'helper'];
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Недопустимая роль' });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role },
  });

  res.json({
    message: 'Роль успешно изменена',
    role: updated.role,
  });
});

// ====== ПОСТЫ =====

app.get('/api/posts', async (req: Request, res: Response) => {
  try {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        author: true,
        likes: true,
      },
    });

    const currentUser = await getUserFromReq(req);

    const formattedPosts = posts.map((post) => ({
      id: post.id,
      author: {
        name: `${post.author.firstName} ${post.author.lastName || ''}`.trim(),
        username: post.author.username,
        avatar: post.author.avatar || '',
        role: post.author.role,
        status: post.author.status,
      },
      content: post.content,
      image: post.imageUrl || undefined,
      likes: post.likes.length,
      isLiked: currentUser ? post.likes.some((l) => l.userId === currentUser.id) : false,
      createdAt: post.createdAt,
    }));

    res.json(formattedPosts);
  } catch (error) {
    console.error('Ошибка загрузки постов:', error);
    res.status(500).json({ error: 'Ошибка загрузки постов' });
  }
});

app.post('/api/posts', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Сначала войдите в систему' });

    const { content, imageUrl } = req.body || {};
    if (!content || typeof content !== 'string' || content.trim() === '') {
      return res.status(400).json({ error: 'Текст поста не может быть пустым' });
    }

    const post = await prisma.post.create({
      data: {
        content: content.trim(),
        imageUrl: imageUrl || null,
        authorId: user.id,
      },
      include: {
        author: true,
        likes: true,
      },
    });

    return res.status(201).json({
      id: post.id,
      author: {
        name: `${post.author.firstName} ${post.author.lastName || ''}`.trim(),
        username: post.author.username,
        avatar: post.author.avatar || '',
        role: post.author.role,
        status: post.author.status,
      },
      content: post.content,
      image: post.imageUrl || undefined,
      likes: 0,
      isLiked: false,
      createdAt: post.createdAt,
    });
  } catch (error) {
    console.error('Ошибка создания поста:', error);
    return res.status(500).json({ error: 'Не удалось сохранить пост в БД' });
  }
});

app.post('/api/posts/:id/like', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Авторизуйтесь для оценки постов' });

    const postId = req.params.id;

    const existingLike = await prisma.like.findUnique({
      where: {
        postId_userId: { postId, userId: user.id },
      },
    });

    if (existingLike) {
      await prisma.like.delete({ where: { id: existingLike.id } });
    } else {
      await prisma.like.create({
        data: { postId, userId: user.id },
      });
    }

    const likesCount = await prisma.like.count({ where: { postId } });
    return res.json({ likes: likesCount, isLiked: !existingLike });
  } catch (error) {
    console.error('Ошибка постановки лайка:', error);
    return res.status(500).json({ error: 'Ошибка обновления лайка' });
  }
});

// ====== CLUSTER & MESH ROUTES ======

app.get('/api/cluster/nodes', async (req: Request, res: Response) => {
  const status = await clusterService.getClusterStatus();
  res.json(status);
});

app.listen(config.port, '0.0.0.0', async () => {
  await initDefaultUser();
  console.log(`[Z Backend] Сервер готов к запросам на 0.0.0.0:${config.port} (Node: ${config.nodeId})`);
});

export default app;