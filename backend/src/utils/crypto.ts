import crypto from 'crypto';
import { prisma } from '../prisma';

const ALGORITHM = 'aes-256-gcm';

// Кеш для ключей, чтобы не ходить в базу при каждой операции
let keyCache: Record<number, Buffer> = {};

async function getKey(version?: number): Promise<{ id: number, key: Buffer }> {
  const p = prisma as any;
  
  if (version && keyCache[version]) {
    return { id: version, key: keyCache[version] };
  }

  // Если версия не указана, берем самый новый ключ
  const keyRecord = version 
    ? await p.encryptionKey.findUnique({ where: { id: version } })
    : await p.encryptionKey.findFirst({ orderBy: { createdAt: 'desc' } });

  if (!keyRecord) {
    throw new Error('No encryption keys found in database');
  }

  const keyBuffer = Buffer.from(keyRecord.key, 'hex');
  keyCache[keyRecord.id] = keyBuffer;
  return { id: keyRecord.id, key: keyBuffer };
}

export async function encryptField(plainText: string | null | undefined): Promise<string | null> {
  if (!plainText) return null;
  try {
    const { id, key } = await getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Формат: v[ID]:iv:authTag:encrypted
    return `v${id}:${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('Encryption failed:', err);
    return plainText;
  }
}

export async function decryptField(encryptedText: string | null | undefined): Promise<string | null> {
  if (!encryptedText || !encryptedText.startsWith('v')) return encryptedText || null;
  
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 4) return encryptedText;
    
    const version = parseInt(parts[0].replace('v', ''));
    const iv = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const encrypted = parts[3];
    
    const { key } = await getKey(version);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return encryptedText;
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, combined: string): boolean {
  if (!combined || !combined.includes(':')) return false;
  const [salt, keyHex] = combined.split(':');
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

// BUCKET MEDIA ENCRYPTION
export function encryptBuffer(buffer: Buffer, secret: string = 'z_mesh_storage_secret_key_32bytes'): Buffer {
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

export function decryptBuffer(encryptedBuffer: Buffer, secret: string = 'z_mesh_storage_secret_key_32bytes'): Buffer {
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = encryptedBuffer.subarray(0, 12);
  const tag = encryptedBuffer.subarray(12, 28);
  const data = encryptedBuffer.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}