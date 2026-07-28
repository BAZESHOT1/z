import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

// Переменная для хранения экземпляра, которая инициализируется позже
export let prisma: PrismaClient;

/**
 * Критическая инициализация базы данных.
 * Должна быть вызвана ПЕРВОЙ в bootstrap.
 */
export async function initDb() {
  console.log('\x1b[35m%s\x1b[0m', '[DATABASE] 🔄 Синхронизация структуры и генерация клиента...');
  try {
    // 1. Принудительно генерируем код клиента в node_modules
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    // 2. Обновляем таблицы в БД без генерации (мы ее сделали шагом выше)
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
    
    // 3. Создаем НОВЫЙ экземпляр клиента. 
    // Теперь он точно знает про _count, EncryptionKey и другие новые поля.
    prisma = new PrismaClient();
    
    await prisma.$connect();
    console.log('  └─ ✅ База данных готова, клиент инициализирован с новой схемой.');
  } catch (e: any) {
    console.error('  └─ ❌ Ошибка БД при инициализации:', e.message);
    throw e;
  }
}