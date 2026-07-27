import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { config } from './config.js';
import { clusterService } from './services/clusterService.js';

const app = express();
export const prisma = new PrismaClient();

// Настройка CORS с помощью пакета cors
app.use(
  cors({
    origin: true, // Разрешает текущий Origin запроса (например, http://localhost:32109)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  })
);

app.use(express.json());

// Логирование входящих запросов в консоль Docker
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.url} | Origin: ${req.headers.origin || 'N/A'}`);
  next();
});

// Инициализация дефолтного пользователя
async function initDefaultUser() {
  try {
    const existingUser = await prisma.user.findFirst();
    if (!existingUser) {
      await prisma.user.create({
        data: {
          username: 'master_admin',
          name: 'Администратор Ноды',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
        },
      });
      console.log('[Database] Создан дефолтный пользователь master_admin');
    }
  } catch (err) {
    console.error('[Database] Ошибка проверки пользователя:', err);
  }
}

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'SocialNet API',
    nodeId: config.nodeId,
    isMaster: config.isMasterNode,
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
  });
});

// GET /api/posts — Получение всех постов из базы данных
app.get('/api/posts', async (req: Request, res: Response) => {
  try {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        author: true,
        likes: true,
      },
    });

    const formattedPosts = posts.map((post) => ({
      id: post.id,
      author: {
        name: post.author.name,
        username: post.author.username,
        avatar: post.author.avatar || '',
      },
      content: post.content,
      image: post.imageUrl || undefined,
      likes: post.likes.length,
      isLiked: post.likes.some((l) => l.userId === post.authorId),
      createdAt: post.createdAt,
    }));

    res.json(formattedPosts);
  } catch (error) {
    console.error('Ошибка получения постов:', error);
    res.status(500).json({ error: 'Ошибка сервера при загрузке постов' });
  }
});

// POST /api/posts — Создание нового поста в базе данных
app.post('/api/posts', async (req: Request, res: Response): Promise<any> => {
  try {
    const { content, imageUrl } = req.body || {};
    if (!content || typeof content !== 'string' || content.trim() === '') {
      return res.status(400).json({ error: 'Текст поста не может быть пустым' });
    }

    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          username: 'user_' + Math.floor(Math.random() * 1000),
          name: 'Пользователь Mesh',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
        },
      });
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
        name: post.author.name,
        username: post.author.username,
        avatar: post.author.avatar || '',
      },
      content: post.content,
      image: post.imageUrl || undefined,
      likes: 0,
      isLiked: false,
      createdAt: post.createdAt,
    });
  } catch (error) {
    console.error('Ошибка при создании поста:', error);
    return res.status(500).json({ error: 'Не удалось сохранить пост в БД' });
  }
});

// POST /api/posts/:id/like — Лайк
app.post('/api/posts/:id/like', async (req: Request, res: Response): Promise<any> => {
  try {
    const postId = req.params.id;
    const user = await prisma.user.findFirst();
    if (!user) return res.status(400).json({ error: 'Пользователь не найден' });

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
    return res.status(500).json({ error: 'Ошибка обновления лайка' });
  }
});

// ====== CLUSTER & MESH ROUTES ======

app.get('/api/cluster/nodes', async (req: Request, res: Response) => {
  const status = await clusterService.getClusterStatus();
  res.json(status);
});

app.post('/api/cluster/register', async (req: Request, res: Response): Promise<any> => {
  const { nodeId, url, secret } = req.body || {};
  if (secret !== config.clusterSecret) {
    return res.status(403).json({ error: 'Неверный токен безопасности кластера' });
  }

  await clusterService.registerNode({
    nodeId,
    url,
    status: 'active',
    isMaster: false,
    lastSeen: new Date().toISOString(),
    dbSyncProgress: 100,
  });

  return res.json({ status: 'registered', masterNodeId: config.nodeId });
});

app.post('/api/cluster/heartbeat', async (req: Request, res: Response) => {
  const { nodeId } = req.body || {};
  if (nodeId) {
    await clusterService.handleHeartbeat(nodeId);
  }
  res.json({ status: 'ack' });
});

app.listen(config.port, '0.0.0.0', async () => {
  await initDefaultUser();
  console.log(`[SocialNet Backend] Сервер готов к запросам на 0.0.0.0:${config.port} (Node: ${config.nodeId})`);
});

export default app;