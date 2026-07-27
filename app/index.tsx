import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://82.26.152.225:4000';

interface Post {
  id: string;
  author: {
    name: string;
    username: string;
    avatar: string;
  };
  content: string;
  image?: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  timeAgo: string;
}

interface ClusterNodeInfo {
  nodeId: string;
  url: string;
  status: string;
  isMaster: boolean;
  lastSeen: string;
  dbSyncProgress: number;
}

const INITIAL_POSTS: Post[] = [
  {
    id: '1',
    author: {
      name: 'Алексей Смирнов',
      username: 'alex_dev',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    },
    content: '🚀 Запустили ноду социальной сети на сервере 82.26.152.225:4000! База данных PostgreSQL работает на порту 5435.',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
    likes: 42,
    comments: 8,
    isLiked: false,
    timeAgo: '15 минут назад',
  },
];

export default function SocialApp() {
  const [activeTab, setActiveTab] = useState<'feed' | 'cluster' | 'profile'>('feed');
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [nodes, setNodes] = useState<ClusterNodeInfo[]>([]);

  useEffect(() => {
    // Загрузка состояния нод сети при переключении на вкладку кластера
    if (activeTab === 'cluster') {
      fetch(`${API_URL}/api/cluster/nodes`)
        .then((res) => res.json())
        .then((data) => {
          setNodes(data.nodes || []);
        })
        .catch(() => {
          // Заглушка если сервер подгружается
          setNodes([
            {
              nodeId: 'zzz',
              url: 'http://82.26.152.225:4000',
              status: 'active',
              isMaster: true,
              lastSeen: new Date().toLocaleTimeString(),
              dbSyncProgress: 100,
            },
          ]);
        });
    }
  }, [activeTab]);

  const toggleLike = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logoText}>SocialNet Mesh</Text>
        <TouchableOpacity style={styles.createPostBtn}>
          <Text style={styles.createPostBtnText}>+ Пост</Text>
        </TouchableOpacity>
      </View>

      {/* Feed Tab */}
      {activeTab === 'feed' && (
        <ScrollView style={styles.feedScroll} showsVerticalScrollIndicator={false}>
          {posts.map((post) => (
            <View key={post.id} style={styles.postCard}>
              <View style={styles.postHeader}>
                <Image source={{ uri: post.author.avatar }} style={styles.authorAvatar} />
                <View style={styles.postHeaderInfo}>
                  <Text style={styles.authorName}>{post.author.name}</Text>
                  <Text style={styles.postTime}>@{post.author.username} • {post.timeAgo}</Text>
                </View>
              </View>

              <Text style={styles.postText}>{post.content}</Text>

              {post.image && (
                <Image source={{ uri: post.image }} style={styles.postImage} resizeMode="cover" />
              )}

              <View style={styles.postActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post.id)}>
                  <Text style={styles.actionIcon}>{post.isLiked ? '❤️' : '🤍'}</Text>
                  <Text style={[styles.actionText, post.isLiked && styles.likedText]}>
                    {post.likes}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Cluster Nodes Monitor Tab */}
      {activeTab === 'cluster' && (
        <ScrollView style={styles.feedScroll} contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.centerTitle}>🌐 Мониторинг Mesh-Сети Нод</Text>
          <Text style={styles.centerSub}>
            Распределенная система синхронизации баз данных и медиа-контента.
          </Text>

          <View style={styles.clusterCard}>
            <Text style={styles.clusterCardTitle}>Центральный сервер (VPS)</Text>
            <Text style={styles.clusterDetail}>IP: 82.26.152.225</Text>
            <Text style={styles.clusterDetail}>Порт API Бэкенда: 4000</Text>
            <Text style={styles.clusterDetail}>Порт PostgreSQL DB: 5435</Text>
            <Text style={styles.clusterDetail}>Порт Redis: 6453</Text>
          </View>

          <Text style={{ fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 8, color: '#111827' }}>
            Активные ноды в сети ({nodes.length}):
          </Text>

          {nodes.map((node, index) => (
            <View key={node.nodeId || index} style={styles.nodeItem}>
              <View style={styles.nodeHeader}>
                <Text style={styles.nodeIdText}>{node.nodeId}</Text>
                <View style={[styles.statusBadge, { backgroundColor: '#10b981' }]}>
                  <Text style={styles.statusBadgeText}>{node.isMaster ? 'MASTER' : 'WORKER'}</Text>
                </View>
              </View>
              <Text style={styles.nodeSub}>Репликация БД: {node.dbSyncProgress}%</Text>
              <Text style={styles.nodeSub}>Статус: {node.status.toUpperCase()}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Bottom Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('feed')}>
          <Text style={[styles.navIcon, activeTab === 'feed' && styles.navActive]}>🏠</Text>
          <Text style={[styles.navLabel, activeTab === 'feed' && styles.navLabelActive]}>Лента</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('cluster')}>
          <Text style={[styles.navIcon, activeTab === 'cluster' && styles.navActive]}>🌐</Text>
          <Text style={[styles.navLabel, activeTab === 'cluster' && styles.navLabelActive]}>Ноды (Mesh)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('profile')}>
          <Text style={[styles.navIcon, activeTab === 'profile' && styles.navActive]}>👤</Text>
          <Text style={[styles.navLabel, activeTab === 'profile' && styles.navLabelActive]}>Профиль</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f5f8',
  },
  header: {
    height: 56,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#6366f1',
  },
  createPostBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createPostBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  feedScroll: {
    flex: 1,
  },
  postCard: {
    backgroundColor: '#ffffff',
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    marginHorizontal: 8,
    marginTop: 8,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  authorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
  },
  postHeaderInfo: {
    justifyContent: 'center',
  },
  authorName: {
    fontWeight: '700',
    fontSize: 15,
    color: '#1f2937',
  },
  postTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  postText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 10,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 10,
  },
  postActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  actionText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  likedText: {
    color: '#ef4444',
    fontWeight: '700',
  },
  centerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  centerSub: {
    color: '#6b7280',
    fontSize: 13,
    marginBottom: 16,
  },
  clusterCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
  },
  clusterCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    color: '#111827',
  },
  clusterDetail: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 2,
  },
  nodeItem: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  nodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  nodeIdText: {
    fontWeight: '700',
    fontSize: 14,
    color: '#1f2937',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  nodeSub: {
    fontSize: 12,
    color: '#6b7280',
  },
  navBar: {
    height: 60,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    fontSize: 18,
    opacity: 0.5,
  },
  navActive: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#6366f1',
    fontWeight: '700',
  },
});