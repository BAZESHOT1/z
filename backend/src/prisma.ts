import { PrismaClient } from '@prisma/client';

// Экспортируем экземпляр, который будет использоваться всеми сервисами
export const prisma = new PrismaClient();

/**
 * Функция для принудительного обновления клиента и схемы
 * Вызывается при старте системы
 */
export async function initDb() {
  const { execSync } = require('child_process');
  console.log('\x1b[35m%s\x1b[0m', '[DATABASE] 🔄 Синхронизация структуры...');
  try {
    // Генерируем клиент на основе текущей schema.prisma
    execSync('npx prisma generate', { stdio: 'inherit' });
    // Обновляем таблицы в БД
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
    
    // Проверяем соединение
    await prisma.$connect();
    console.log('  └─ ✅ База данных готова и клиент обновлен.');
  } catch (e: any) {
    console.error('  └─ ❌ Ошибка БД:', e.message);
    throw e;
  }
}