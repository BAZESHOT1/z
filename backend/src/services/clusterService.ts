import { config } from '../config.js';

export interface ClusterNode {
  nodeId: string;
  url: string;
  status: 'active' | 'syncing' | 'offline';
  isMaster: boolean;
  lastSeen: string;
  dbSyncProgress: number;
}

class ClusterService {
  private activeNodes: Map<string, ClusterNode> = new Map();

  constructor() {
    // Добавляем текущую ноду в список
    this.registerSelf();
    
    if (!config.isMasterNode && config.masterNodeUrl) {
      this.connectToMaster();
    }
  }

  private registerSelf() {
    this.activeNodes.set(config.nodeId, {
      nodeId: config.nodeId,
      url: `http://localhost:${config.port}`,
      status: 'active',
      isMaster: config.isMasterNode,
      lastSeen: new Date().toISOString(),
      dbSyncProgress: 100,
    });
  }

  // Регистрация ведомой ноды на Мастере
  public registerNode(node: ClusterNode): boolean {
    this.activeNodes.set(node.nodeId, {
      ...node,
      status: 'active',
      lastSeen: new Date().toISOString(),
    });
    console.log(`[Mesh Cluster] Подключена новая нода: ${node.nodeId} (${node.url})`);
    return true;
  }

  // Обработка Heartbeat от нод
  public handleHeartbeat(nodeId: string) {
    const existing = this.activeNodes.get(nodeId);
    if (existing) {
      existing.lastSeen = new Date().toISOString();
      existing.status = 'active';
    }
  }

  // Подключение к Мастер-ноде при запуске Воркера
  private async connectToMaster() {
    try {
      console.log(`[Mesh Cluster] Попытка соединения с мастер-нодой: ${config.masterNodeUrl}`);
      // Здесь отправляется handshake запрос на masterNodeUrl/api/cluster/register
    } catch (e) {
      console.error('[Mesh Cluster] Ошибка подключения к мастер-ноде:', e);
    }
  }

  // Получить статус сети и список активных нод
  public getClusterStatus() {
    return {
      currentNode: {
        nodeId: config.nodeId,
        isMaster: config.isMasterNode,
        deploymentMode: config.deploymentMode,
      },
      totalNodes: this.activeNodes.size,
      nodes: Array.from(this.activeNodes.values()),
    };
  }
}

export const clusterService = new ClusterService();