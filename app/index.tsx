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
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { fetchPosts, createPost, togglePostLike, fetchClusterNodes, API_URL } from './api';

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
  isLiked: boolean;
  createdAt: string;
}

interface ClusterNodeInfo {
  nodeId: string;
  url: string;
  status: string;
  isMaster: boolean;
  lastSeen: string;
  dbSyncProgress: number;
}

export default function SocialApp() {
  const [activeTab, setActiveTab] = useState<'feed' | 'cluster' | 'profile'>('feed');
  const [posts, setPosts] = useState<Post[]>([]);
  const [nodes, setNodes] = useState<ClusterNodeInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Состояние создания поста
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  const loadFeed = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchPosts();
      setPosts(data);
    } catch (err: any) {
      setErrorMsg('Не удалось подключиться к бэкенду БД (' + API_URL + ')');
    } finally {
      setLoading(false);
    }
  };

  const loadNodes = async () => {
    try {
      const data = await fetchClusterNodes();
      setNodes(data.nodes || []);
    } catch (err) {
      setNodes([]);
    }
  };

  useEffect(() => {
    if (activeTab === 'feed') {
      loadFeed();
    } else if (activeTab === 'cluster') {
      loadNodes();
    }
  }, [activeTab]);

  const handleLike = async (postId: string) => {
    try {
      // Оптимистичное обновление
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 }
            : p
        )
      );
      await togglePostLike(postId);
    } catch (e) {
      // Откатить назад в случае ошибки
      loadFeed();
    }
  };

  const handleCreatePost = async () => {
    if (!newContent.trim()) {
      Alert.alert('Ошибка', 'Введите текст поста');
      return;
    }

    setIsPublishing(true);
    try {
      const created = await createPost(newContent, newImageUrl || undefined);
      setPosts((prev) => [created, ...prev]);
      setNewContent('');
      setNewImageUrl('');
      setIsModalOpen(false);
    } catch (e: any) {
      Alert.alert('Ошибка', 'Не удалось отправить пост в базу данных');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logoText}>SocialNet Mesh</Text>
        <TouchableOpacity style={styles.createPostBtn} onPress={() => setIsModalOpen(true)}>
          <Text style={styles.createPostBtnText}>+ Пост</Text>
        </TouchableOpacity>
      </View>

      {/* Feed Tab */}
      {activeTab === 'feed' && (
        <View style={{ flex: 1 }}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.loadingText}>Загрузка постов из PostgreSQL...</Text>
            </View>
          ) : errorMsg ? (
            <View style={styles.centerContainer}>
              <Text style={styles.errorText}>{errorMsg}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadFeed}>
                <Text style={styles.retryBtnText}>Повторить попытку</Text>
              </TouchableOpacity>
            </View>
          ) : posts.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyTitle}>В базе данных нет постов</Text>
              <Text style={styles.emptySub}>Будьте первым, кто опубликует запись!</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => setIsModalOpen(true)}>
                <Text style={styles.retryBtnText}>Написать пост</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={styles.feedScroll} showsVerticalScrollIndicator={false}>
              {posts.map((post) => (
                <View key={post.id} style={styles.postCard}>
                  <View style={styles.postHeader}>
                    <Image
                      source={{ uri: post.author.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150' }}
                      style={styles.authorAvatar}
                    />
                    <View style={styles.postHeaderInfo}>
                      <Text style={styles.authorName}>{post.author.name}</Text>
                      <Text style={styles.postTime}>@{post.author.username} • {new Date(post.createdAt).toLocaleTimeString()}</Text>
                    </View>
                  </View>

                  <Text style={styles.postText}>{post.content}</Text>

                  {post.image && (
                    <Image source={{ uri: post.image }} style={styles.postImage} resizeMode="cover" />
                  )}

                  <View style={styles.postActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(post.id)}>
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
        </View>
      )}

      {/* Cluster Nodes Monitor Tab */}
      {activeTab === 'cluster' && (
        <ScrollView style={styles.feedScroll} contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.centerTitle}>🌐 Мониторинг Mesh-Сети Нод</Text>
          <Text style={styles.centerSub}>
            Прямые данные о нодах из бэкенда и PostgreSQL.
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

          {nodes.length === 0 ? (
            <Text style={{ color: '#6b7280', marginTop: 8 }}>Ноды не зарегистрированы или бэкенд выключен.</Text>
          ) : (
            nodes.map((node, index) => (
              <View key={node.nodeId || index} style={styles.nodeItem}>
                <View style={styles.nodeHeader}>
                  <Text style={styles.nodeIdText}>{node.nodeId}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: '#10b981' }]}>
                    <Text style={styles.statusBadgeText}>{node.isMaster ? 'MASTER' : 'WORKER'}</Text>
                  </View>
                </View>
                <Text style={styles.nodeSub}>Репликация БД: {node.dbSyncProgress}%</Text>
                <Text style={styles.nodeSub}>Статус: {node.status.toUpperCase()}</Text>
                <Text style={styles.nodeSub}>URL: {node.url}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <View style={styles.centerContainer}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200' }}
            style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 12 }}
          />
          <Text style={styles.centerTitle}>Администратор Ноды</Text>
          <Text style={styles.centerSub}>@master_admin</Text>
        </View>
      )}

      {/* Modal Создания Поста */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Создать новую запись</Text>

            <TextInput
              style={styles.textInput}
              placeholder="Что у вас нового?"
              multiline
              numberOfLines={4}
              value={newContent}
              onChangeText={setNewContent}
            />

            <TextInput
              style={styles.singleInput}
              placeholder="Ссылка на изображение (необязательно)"
              value={newImageUrl}
              onChangeText={setNewImageUrl}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsModalOpen(false)}
                disabled={isPublishing}
              >
                <Text style={styles.cancelBtnText}>Отмена</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.publishBtn}
                onPress={handleCreatePost}
                disabled={isPublishing}
              >
                {isPublishing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.publishBtnText}>Опубликовать</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 14,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  emptySub: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#ffffff',
    fontWeight: '600',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1f2937',
  },
  textInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 14,
    marginBottom: 12,
  },
  singleInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelBtnText: {
    color: '#6b7280',
    fontWeight: '600',
  },
  publishBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  publishBtnText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});