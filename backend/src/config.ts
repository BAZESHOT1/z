import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'production',
  
  // Автоматически строит URL из переменных
  databaseUrl: process.env.DATABASE_URL || 
    `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${process.env.POSTGRES_HOST || 'postgres'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'socialnet'}`,
  
  redisUrl: process.env.REDIS_URL || 
    `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || '6379'}`,
  
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
  jwtSecret: process.env.JWT_SECRET || 'default_secret',
  adminEmails: process.env.ADMIN_EMAILS?.split(',') || [],
  aiApiKeys: process.env.AI_API_KEYS?.split(',') || [],
  deploymentMode: process.env.DEPLOYMENT_MODE || 'local',
  autoMigrate: process.env.AUTO_MIGRATE === 'true',
};