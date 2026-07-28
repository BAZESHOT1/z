import crypto from 'crypto';
import cron from 'node-cron';
import { prisma } from '../app';

class KeyRotationService {
  public async start() {
    // Проверка каждые 24 часа
    cron.schedule('0 0 * * *', () => this.rotateIfNeeded());
    
    // Первый запуск при старте
    await this.rotateIfNeeded();
  }

  private async rotateIfNeeded() {
    const p = prisma as any;
    try {
      const latestKey = await p.encryptionKey.findFirst({
        orderBy: { createdAt: 'desc' }
      });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (!latestKey || latestKey.createdAt < thirtyDaysAgo) {
        console.log('[KeyRotation] Generating new encryption key...');
        await p.encryptionKey.create({
          data: {
            key: crypto.randomBytes(32).toString('hex'),
            createdAt: new Date()
          }
        });
        console.log('[KeyRotation] New key activated.');
      }
    } catch (e) {
      console.error('[KeyRotation] Failed to rotate keys:', e);
    }
  }
}

export const keyRotation = new KeyRotationService();