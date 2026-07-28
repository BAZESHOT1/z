import express, { Request, Response } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { encryptField, decryptField, hashPassword, verifyPassword } from './utils/crypto';
import { gitWatcher } from './services/gitWatcher';
import { clusterService } from './services/clusterService';

const app = express();
export const prisma = new PrismaClient();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Запуск Mesh-сервисов
gitWatcher.start();
if (!config.isMasterNode) {
  clusterService.sendHeartbeat();
}

// Эндпоинты для управления кластером (только для Master)
app.post('/api/cluster/register', async (req, res) => {
  if (!config.isMasterNode) return res.status(403).send('Only Master can register nodes');
  const { nodeId, url, owner, secret } = req.body;
  
  if (secret !== config.clusterSecret) return res.status(401).send('Invalid secret');
  
  try {
    const p = prisma as any;
    await p.clusterNode.upsert({
      where: { nodeId },
      update: { url, status: 'active', owner, lastSeen: new Date() },
      create: { nodeId, url, status: 'active', owner }
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'DB Error' }); }
});

app.post('/api/cluster/heartbeat', async (req, res) => {
  if (!config.isMasterNode) return res.status(403).send('Master only');
  const { nodeId } = req.body;
  try {
    await (prisma as any).clusterNode.update({
      where: { nodeId },
      data: { lastSeen: new Date(), status: 'active' }
    });
    res.json({ ok: true });
  } catch (e) { res.status(404).send('Node not found'); }
});

// Основная логика Auth и Profile (с шифрованием)
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { username, password, email } = req.body;
    // Только Master шифрует данные перед сохранением
    const data = {
      username,
      password: hashPassword(password),
      email: email ? encryptField(email) : null
    };
    const user = await prisma.user.create({ data });
    res.status(201).json({ token: jwt.sign({ userId: user.id }, config.jwtSecret), user });
  } catch (err) { res.status(400).json({ error: 'Exists' }); }
});

// ... остальные методы теперь автоматически используют encryptField/decryptField

app.listen(config.port, '0.0.0.0', () => {
  console.log(`🚀 Z-${config.isMasterNode ? 'MASTER' : 'COMMUNITY'} Node running on port ${config.port}`);
});