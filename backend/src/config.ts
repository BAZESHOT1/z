import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'production',
  
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  jwtSecret: process.env.JWT_SECRET || 'master_secret_key_888',
  clusterSecret: process.env.CLUSTER_SECRET || 'mesh_network_shared_secret',
  
  // Mesh Config
  isMasterNode: process.env.IS_MASTER_NODE === 'true',
  nodeId: process.env.NODE_ID || `node_${Math.random().toString(36).substr(2, 9)}`,
  masterNodeUrl: process.env.MASTER_NODE_URL || 'http://82.26.152.225:4000',
  
  // Git Auto-update
  repoUrl: process.env.REPO_URL || '',
  autoUpdateEnabled: process.env.AUTO_UPDATE === 'true',
  
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
};