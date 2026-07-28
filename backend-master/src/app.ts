import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { keyRotation } from './services/keyRotation';
import { encryptField, decryptField } from './utils/crypto';

const app = express();
export const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Master специфичные воркеры
keyRotation.start();

app.get('/api/auth/me', async (req, res) => {
  // Логика получения профиля с расшифровкой био
  res.json({ status: 'Master Online' });
});

app.post('/api/cluster/register', async (req, res) => {
  const { nodeId, owner } = req.body;
  console.log(`[Master] Registering community node ${nodeId} for user ${owner}`);
  res.json({ success: true, key_version: 1 });
});

app.listen(3000, '0.0.0.0', () => console.log('🚀 Z-MASTER running on port 3000'));