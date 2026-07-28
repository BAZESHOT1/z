import axios from 'axios';
import { config } from '../config';
import { prisma } from '../app';

export class ClusterService {
  public async registerWithMaster(username: string) {
    if (config.isMasterNode) return;

    try {
      await axios.post(`${config.masterNodeUrl}/api/cluster/register`, {
        nodeId: config.nodeId,
        url: `http://${process.env.PUBLIC_IP || 'localhost'}:${config.port}`,
        owner: username,
        secret: config.clusterSecret
      });
      console.log('[Cluster] Successfully registered with Master node.');
    } catch (e) {
      console.error('[Cluster] Registration failed. Retrying in 30s...');
      setTimeout(() => this.registerWithMaster(username), 30000);
    }
  }

  public async sendHeartbeat() {
    if (config.isMasterNode) return;
    
    setInterval(async () => {
      try {
        await axios.post(`${config.masterNodeUrl}/api/cluster/heartbeat`, {
          nodeId: config.nodeId,
          status: 'online',
          load: process.cpuUsage()
        });
      } catch (e) {
        console.error('[Cluster] Heartbeat failed');
      }
    }, 60000);
  }

  public async getAvailableNodes() {
    return await (prisma as any).clusterNode.findMany({
      where: { status: 'active' }
    });
  }
}

export const clusterService = new ClusterService();