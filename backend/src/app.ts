import express, { Request, Response } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { encryptField, decryptField, hashPassword, verifyPassword } from './utils/crypto';
import { gitWatcher } from './services/gitWatcher';
import { clusterService } from './services/clusterService';
import { keyRotation } from './services/keyRotation';

const app = express();
export const prisma = new PrismaClient();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

async function init() {
  gitWatcher.start();
  
  if (config.isMasterNode) {
    // Мастер-ноды запускают воркер ротации
    await keyRotation.start();
    console.log('🛡️ Key Rotation Service active');
  } else {
    clusterService.sendHeartbeat();
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`🚀 Z-${config.isMasterNode ? 'MASTER' : 'COMMUNITY'} Node running on port ${config.port}`);
  });
}

// Эндпоинты для Auth с поддержкой асинхронного шифрования
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { username, password, email } = req.body;
    const encryptedEmail = await encryptField(email);
    
    const user = await prisma.user.create({
      data: {
        username,
        password: hashPassword(password),
        email: encryptedEmail
      }
    });
    res.status(201).json({ token: jwt.sign({ userId: user.id }, config.jwtSecret), user });
  } catch (err) { res.status(400).json({ error: 'Exists' }); }
});

app.get('/api/auth/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send();
  
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(404).send();
    
    // Расшифровка перед отправкой
    const decryptedBio = await decryptField(user.bio);
    res.json({ ...user, bio: decryptedBio });
  } catch (e) { res.status(401).send(); }
});

init();