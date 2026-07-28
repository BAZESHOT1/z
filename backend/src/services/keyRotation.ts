import crypto from 'crypto';
import cron from 'node-cron';
import { prisma } from '../prisma';

class KeyRotationService {
  public async start() {
    // Проверка раз в сутки
    cron.schedule('0 0 * * *', () => this.rotateIfNeeded());
    await this.rotateIfNeeded();
  }

  private async rotateIfNeeded() {
    if (!prisma) return; // Защита от раннего вызова
    try {
      const latestKey = await prisma.encryptionKey.findFirst({
        orderBy: { createdAt: 'desc' }
      });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (!latestKey || latestKey.createdAt < thirtyDaysAgo) {
        console.log('[KeyRotation] 🔑 Ротация ключей...');
        await prisma.encryptionKey.create({
          data: {
            key: crypto.randomBytes(32).toString('hex'),
            createdAt: new Date()
          }
        });
      }
    } catch (e: any) {
      console.error('[KeyRotation] ❌ Ошибка ротации:', e.message);
    }
  }
}

export const keyRotation = new KeyRotationService();