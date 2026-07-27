import crypto from 'crypto';
import { config } from '../config';

// Вычисление 32-байтного ключа шифрования на основе JWT_SECRET
const ENCRYPTION_KEY = crypto.createHash('sha256').update(config.jwtSecret || 'default_secret').digest();
const ALGORITHM = 'aes-256-gcm';

// Хэширование пароля (Scrypt с солью)
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

// Проверка пароля
export function verifyPassword(password: string, combined: string): boolean {
  if (!combined || !combined.includes(':')) return false;
  const [salt, keyHex] = combined.split(':');
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

// Шифрование данных конфиденциальных полей (Bio, SocialLinks, BirthDate)
export function encryptField(plainText: string | null | undefined): string | null {
  if (!plainText) return null;
  try {
    const iv = crypto.randomBytes(12); // 96-битный IV для GCM
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('Ошибка шифрования поля:', err);
    return plainText;
  }
}

// Расшифровка данных полей
export function decryptField(encryptedText: string | null | undefined): string | null {
  if (!encryptedText) return null;
  if (!encryptedText.includes(':')) return encryptedText; // Возвращаем как есть, если строка не зашифрована
  
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return encryptedText;
    
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return encryptedText; // В случае ошибки декодирования возвращаем исходную строку
  }
}