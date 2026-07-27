import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config.js';

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
    timestamp: new Date().toISOString(),
    env: config.nodeEnv
  });
});

// Posts API Mock Route
app.get('/api/posts', (req: Request, res: Response) => {
  res.json([
    {
      id: '1',
      content: 'Добро пожаловать в SocialNet! Наш стек: Express, React Native, PostgreSQL, Redis и Docker.',
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

app.listen(config.port, () => {
  console.log(`[SocialNet Backend] Сервер запущен на порту ${config.port}`);
});

export default app;