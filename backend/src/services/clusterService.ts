import { config } from '../config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ClusterNode {
  nodeId: string;
  url: string;
  status: string;
  isMaster: boolean;
  lastSeen: string;
  dbSyncProgress: number;
}

class ClusterService {
  constructor() {
    this.registerSelf();
  }

  private async registerSelf() {
    try {
      await prisma.clusterNode.upsert({
        where: { nodeId: config.nodeId },
        update: {
          url: `http://localhost:${config.port}`,
          status: 'active',
          isMaster: config.isMasterNode,
          lastSeen: new Date(),
          dbSyncProgress: 100,
        },
        create: {
          nodeId: config.nodeId,
          url: `http://localhost:${config.port}`,
          status: 'active',
          isMaster: config.isMasterNode,
          lastSeen: new Date(),
          dbSyncProgress: 100,
        },
      });
    } catch (e) {
      console.error('[Mesh Cluster] Ошибка регистрации ноды в БД:', e);
    }
  }

  public async registerNode(node: ClusterNode): Promise<boolean> {
    try {
      await prisma.clusterNode.upsert({
        where: { nodeId: node.nodeId },
        update: {
          url: node.url,
          status: 'active',
          isMaster: node.isMaster,
          lastSeen: new Date(),
          dbSyncProgress: node.dbSyncProgress,
        },
        create: {
          nodeId: node.nodeId,
          url: node.url,
          status: 'active',
          isMaster: node.isMaster,
          lastSeen: new Date(),
          dbSyncProgress: node.dbSyncProgress,
        },
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  public async handleHeartbeat(nodeId: string) {
    try {
      await prisma.clusterNode.update({
        where: { nodeId },
        data: { lastSeen: new Date(), status: 'active' },
      });
    } catch (e) {
      // Ignore
    }
  }

  public async getClusterStatus() {
    try {
      const nodes = await prisma.clusterNode.findMany({
        orderBy: { lastSeen: 'desc' },
      });
      return {
        currentNode: {
          nodeId: config.nodeId,
          isMaster: config.isMasterNode,
          deploymentMode: config.deploymentMode,
        },
        totalNodes: nodes.length,
        nodes: nodes.map((n) => ({
          nodeId: n.nodeId,
          url: n.url,
          status: n.status,
          isMaster: n.isMaster,
          lastSeen: n.lastSeen.toISOString(),
          dbSyncProgress: n.dbSyncProgress,
        })),
      };
    } catch (e) {
      return {
        currentNode: { nodeId: config.nodeId, isMaster: config.isMasterNode, deploymentMode: config.deploymentMode },
        totalNodes: 0,
        nodes: [],
      };
    }
  }
}

export const clusterService = new ClusterService();