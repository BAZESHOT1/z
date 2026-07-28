import axios from 'axios';
import { config } from '../config';
import { prisma } from '../prisma';

export class ClusterService {
  public async registerWithMaster(username: string) {
    if (config.isMasterNode) return;
    try {
      await axios.post(`${config.masterNodeUrl}/api/cluster/register`, {
        nodeId: config.nodeId,
        url: `http://localhost:${config.port}`,
        owner: username,
        secret: config.clusterSecret
      });
      console.log('[Cluster] 🛰️  Зарегистрирован на Master-ноде.');
    } catch (e) {
      console.log('[Cluster] ⚠️  Master недоступен, повтор через 30с.');
      setTimeout(() => this.registerWithMaster(username), 30000);
    }
  }

  public async sendHeartbeat() {
    if (config.isMasterNode) return;
    setInterval(async () => {
      try {
        await axios.post(`${config.masterNodeUrl}/api/cluster/heartbeat`, {
          nodeId: config.nodeId,
          status: 'online'
        });
      } catch (e) {}
    }, 60000);
  }
}

export const clusterService = new ClusterService();