import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { clusterService } from './services/clusterService.js';

const app = express();

app.use(cors({
  origin: config.allowedOrigins,
  credentials: true,
}));

app.use(express.json());

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'SocialNet API',
    nodeId: config.nodeId,
    isMaster: config.isMasterNode,
    timestamp: new Date().toISOString(),
    env: config.nodeEnv
  });
});

// Posts API Mock Route
app.get('/api/posts', (req: Request, res: Response) => {
  res.json([
    {
      id: '1',
      content: 'Добро пожаловать в SocialNet! Наш стек: Express, React Native, PostgreSQL, Redis и Docker Mesh Cluster.',
      imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
      createdAt: new Date().toISOString(),
      author: {
        name: 'Alex Developer',
        username: 'alexdev',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'
      },
      likesCount: 24,
      commentsCount: 5,
      isLiked: false
    }
  ]);
});

// ====== CLUSTER & MESH ROUTES ======

// Получение статуса сети и списка всех нод
app.get('/api/cluster/nodes', (req: Request, res: Response) => {
  res.json(clusterService.getClusterStatus());
});

// Регистрация новой ноды в сети
app.post('/api/cluster/register', (req: Request, res: Response): any => {
  const { nodeId, url, secret } = req.body || {};
  if (secret !== config.clusterSecret) {
    return res.status(403).json({ error: 'Неверный токен безопасности кластера' });
  }

  clusterService.registerNode({
    nodeId,
    url,
    status: 'active',
    isMaster: false,
    lastSeen: new Date().toISOString(),
    dbSyncProgress: 100,
  });

  return res.json({ status: 'registered', masterNodeId: config.nodeId });
});

// Heartbeat от ведомой ноды
app.post('/api/cluster/heartbeat', (req: Request, res: Response) => {
  const { nodeId } = req.body || {};
  if (nodeId) {
    clusterService.handleHeartbeat(nodeId);
  }
  res.json({ status: 'ack' });
});

app.listen(config.port, () => {
  console.log(`[SocialNet Backend] Сервер запущен на порту ${config.port} (Node: ${config.nodeId}, Master: ${config.isMasterNode})`);
});

export default app;