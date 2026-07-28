import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const MASTER_URL = process.env.MASTER_NODE_URL || 'http://localhost:4000';

async function sendHeartbeat() {
  try {
    await axios.post(`${MASTER_URL}/api/cluster/heartbeat`, {
      nodeId: process.env.NODE_ID,
      status: 'active'
    });
  } catch (e) {
    console.log('[Community] Master unreachable, retrying...');
  }
}

setInterval(sendHeartbeat, 60000);

app.get('/health', (req: Request, res: Response) => res.json({ status: 'Community Node Active' }));

app.listen(3000, '0.0.0.0', () => console.log('📦 Z-COMMUNITY running on port 3000'));