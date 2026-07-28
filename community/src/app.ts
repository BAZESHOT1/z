import express from 'express';
import axios from 'axios';
import { config } from '../../backend/src/config';

const app = express();
app.use(express.json());

const NODE_ID = process.env.NODE_ID || 'community_node_1';
const MASTER_URL = process.env.MASTER_NODE_URL || 'http://z-backend:3000';

async function registerInCluster() {
  try {
    await axios.post(`${MASTER_URL}/api/cluster/register`, {
      nodeId: NODE_ID,
      url: `http://localhost:4001`,
      secret: 'mesh_network_shared_secret'
    });
    console.log('✅ Registered in Master Cluster');
  } catch (e) {
    console.log('❌ Master unreachable, retrying...');
    setTimeout(registerInCluster, 10000);
  }
}

app.get('/health', (req, res) => res.json({ status: 'Community Online' }));

app.listen(3000, '0.0.0.0', () => {
  console.log('📦 Community Node Active');
  registerInCluster();
});