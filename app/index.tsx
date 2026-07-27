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
import {
  fetchPosts,
  createPost,
  togglePostLike,
  fetchClusterNodes,
  registerUser,
  loginUser,
  fetchCurrentUser,
  updateUserRole,
  setAuthToken,
  API_URL,
} from './api';

interface UserProfile {
  id: string;
  username: string;
  firstName: string;
  lastName?: string;
  role: string;
  status: string;
  bio?: string;
  socialLinks?: string;
  birthDate?: string;
  avatar?: string;
}

interface Post {
  id: string;
  author: {
    name: string;
    username: string;
    avatar: string;
    role: string;
    status: string;
  };
  content: string;
  image?: string;
  likes: number;
  isLiked: boolean;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  root: '#ef4444',
  admin: '#f59e0b',
  moderator: '#10b981',
  tester: '#8b5cf6',
  helper: '#06b6d4',
};

export default function SocialApp() {
  const [activeTab, setActiveTab] = useState<'feed' | 'cluster' | 'profile'>('feed');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Окно создания поста
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  // Окно авторизации/регистрации
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    bio: '',
    socialLinks: '',
    birthDate: '',
  });
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    // Дефолтный автологин под администратора master_admin
    handleQuickLogin('master_admin', 'admin123');
  }, []);

  const handleQuickLogin = async (username: string, pass: string) => {
    try {
      const res = await loginUser({ username, password: pass });
      setAuthToken(res.token);
      setCurrentUser(res.user);
      loadFeed();
    } catch (e) {
      loadFeed();
    }
  };

  const loadFeed = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchPosts();
      setPosts(data);
    } catch (err: any) {
      setErrorMsg('Не удалось подключиться к БД на VPS (' + API_URL + ')');
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
    if (activeTab === 'feed') loadFeed();
    if (activeTab === 'cluster') loadNodes();
  }, [activeTab]);

  const handleAuthSubmit = async () => {
    setAuthLoading(true);
    try {
      let res;
      if (authMode === 'login') {
        res = await loginUser({ username: authForm.username, password: authForm.password });
      } else {
        res = await registerUser(authForm);
      }
      setAuthToken(res.token);
      setCurrentUser(res.user);
      setIsAuthModalOpen(false);
      Alert.alert('Успех', authMode === 'login' ? 'С возвращением!' : 'Вы успешно зарегистрированы!');
      loadFeed();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Ошибка авторизации');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRoleChange = async (newRole: string) => {
    try {
      await updateUserRole(newRole);
      if (currentUser) {
        setCurrentUser({ ...currentUser, role: newRole });
      }
      Alert.alert('Успех', `Ваша роль изменена на: ${newRole.toUpperCase()}`);
      loadFeed();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    }
  };

  const handleCreatePost = async () => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }

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
      setIsPostModalOpen(false);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось отправить пост в базу данных');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    try {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 }
            : p
        )
      );
      await togglePostLike(postId);
    } catch (e) {
      loadFeed();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logoText}>SocialNet Mesh</Text>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {currentUser ? (
            <TouchableOpacity style={styles.userBadgeBtn} onPress={() => setActiveTab('profile')}>
              <Image source={{ uri: currentUser.avatar }} style={styles.miniAvatar} />
              <Text style={styles.miniUsername}>@{currentUser.username}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.authBtn} onPress={() => setIsAuthModalOpen(true)}>
              <Text style={styles.authBtnText}>Войти</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.createPostBtn} onPress={() => setIsPostModalOpen(true)}>
            <Text style={styles.createPostBtnText}>+ Пост</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ЛЕНТА ПОСТОВ */}
      {activeTab === 'feed' && (
        <View style={{ flex: 1 }}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.loadingText}>Загрузка из PostgreSQL...</Text>
            </View>
          ) : errorMsg ? (
            <View style={styles.centerContainer}>
              <Text style={styles.errorText}>{errorMsg}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadFeed}>
                <Text style={styles.retryBtnText}>Повторить попытку</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={styles.feedScroll} showsVerticalScrollIndicator={false}>
              {posts.map((post) => (
                <View key={post.id} style={styles.postCard}>
                  <View style={styles.postHeader}>
                    <View style={{ position: 'relative' }}>
                      <Image
                        source={{ uri: post.author.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150' }}
                        style={styles.authorAvatar}
                      />
                      <View style={[styles.statusDot, { backgroundColor: post.author.status === 'online' ? '#10b981' : '#9ca3af' }]} />
                    </View>

                    <View style={styles.postHeaderInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.authorName}>{post.author.name}</Text>
                        
                        {/* Не отображаем стандартную роль user */}
                        {post.author.role && post.author.role !== 'user' && (
                          <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[post.author.role] || '#6366f1' }]}>
                            <Text style={styles.roleBadgeText}>{post.author.role.toUpperCase()}</Text>
                          </View>
                        )}
                      </View>
                      
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

      {/* СЕТЬ НОД (MESH CLUSTER) */}
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
            Активные узлы сети ({nodes.length}):
          </Text>

          {nodes.length === 0 ? (
            <Text style={{ color: '#6b7280', marginTop: 8 }}>Ноды не зарегистрированы.</Text>
          ) : (
            nodes.map((node, index) => (
              <View key={node.nodeId || index} style={styles.nodeItem}>
                <View style={styles.nodeHeader}>
                  <Text style={styles.nodeIdText}>{node.nodeId}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: '#10b981' }]}>
                    <Text style={styles.statusBadgeText}>{node.isMaster ? 'MASTER BACKEND' : 'REPLICA NODE'}</Text>
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

      {/* ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ */}
      {activeTab === 'profile' && (
        <ScrollView style={{ flex: 1, padding: 16 }}>
          {currentUser ? (
            <View style={{ alignItems: 'center' }}>
              <View style={{ position: 'relative', marginBottom: 12 }}>
                <Image source={{ uri: currentUser.avatar }} style={{ width: 90, height: 90, borderRadius: 45 }} />
                <View style={[styles.statusDotLarge, { backgroundColor: currentUser.status === 'online' ? '#10b981' : '#9ca3af' }]} />
              </View>

              <Text style={styles.profileName}>{currentUser.firstName} {currentUser.lastName || ''}</Text>
              <Text style={styles.profileUsername}>@{currentUser.username}</Text>

              {/* Отображение особой роли */}
              {currentUser.role && currentUser.role !== 'user' && (
                <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[currentUser.role] || '#6366f1', marginTop: 6, paddingHorizontal: 12, paddingVertical: 4 }]}>
                  <Text style={[styles.roleBadgeText, { fontSize: 12 }]}>{currentUser.role.toUpperCase()}</Text>
                </View>
              )}

              {/* Зашифрованное описание (био) */}
              <View style={styles.bioBox}>
                <Text style={styles.bioTitle}>🔒 Описание (Зашифровано AES-256):</Text>
                <Text style={styles.bioText}>{currentUser.bio || 'Описание отсутствует'}</Text>
              </View>

              {/* Ссылки и контакты */}
              {currentUser.socialLinks && (
                <View style={styles.bioBox}>
                  <Text style={styles.bioTitle}>🌐 Ссылки на соцсети:</Text>
                  <Text style={styles.bioText}>{currentUser.socialLinks}</Text>
                </View>
              )}

              {/* Тестовый переключатель ролей */}
              <View style={styles.roleTestCard}>
                <Text style={styles.roleTestTitle}>⚙️ Тестовая смена роли:</Text>
                <Text style={styles.roleTestSub}>Обычная роль "user" скрыта из значков.</Text>
                <View style={styles.roleBtnGrid}>
                  {['user', 'root', 'admin', 'moderator', 'tester', 'helper'].map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.roleSelectBtn,
                        currentUser.role === r && styles.roleSelectBtnActive,
                        { borderColor: ROLE_COLORS[r] || '#6366f1' },
                      ]}
                      onPress={() => handleRoleChange(r)}
                    >
                      <Text style={[styles.roleSelectText, currentUser.role === r && styles.roleSelectTextActive]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={() => {
                  setAuthToken(null);
                  setCurrentUser(null);
                  Alert.alert('Выход', 'Вы вышли из учетной записи');
                }}
              >
                <Text style={styles.logoutBtnText}>Выйти из аккаунта</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyTitle}>Вы не авторизованы</Text>
              <Text style={styles.emptySub}>Войдите или зарегистрируйтесь для доступа к профилю</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => setIsAuthModalOpen(true)}>
                <Text style={styles.retryBtnText}>Войти в аккаунт</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* МОДАЛЬНОЕ ОКНО АВТОРИЗАЦИИ / РЕГИСТРАЦИИ */}
      <Modal visible={isAuthModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>{authMode === 'login' ? 'Вход в аккаунт' : 'Регистрация профиля'}</Text>

            <TextInput
              style={styles.singleInput}
              placeholder="Логин (username)"
              value={authForm.username}
              onChangeText={(t) => setAuthForm({ ...authForm, username: t })}
              autoCapitalize="none"
            />

            <TextInput
              style={styles.singleInput}
              placeholder="Пароль"
              secureTextEntry
              value={authForm.password}
              onChangeText={(t) => setAuthForm({ ...authForm, password: t })}
            />

            {authMode === 'register' && (
              <>
                <TextInput
                  style={styles.singleInput}
                  placeholder="Имя"
                  value={authForm.firstName}
                  onChangeText={(t) => setAuthForm({ ...authForm, firstName: t })}
                />

                <TextInput
                  style={styles.singleInput}
                  placeholder="Фамилия (необязательно)"
                  value={authForm.lastName}
                  onChangeText={(t) => setAuthForm({ ...authForm, lastName: t })}
                />

                <TextInput
                  style={styles.textInput}
                  placeholder="Описание профиля (до 256 символов, шифруется)"
                  maxLength={256}
                  multiline
                  value={authForm.bio}
                  onChangeText={(t) => setAuthForm({ ...authForm, bio: t })}
                />

                <TextInput
                  style={styles.singleInput}
                  placeholder="Ссылки на соцсети"
                  value={authForm.socialLinks}
                  onChangeText={(t) => setAuthForm({ ...authForm, socialLinks: t })}
                />
              </>
            )}

            <TouchableOpacity style={{ marginBottom: 12 }} onPress={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
              <Text style={{ color: '#6366f1', textAlign: 'center' }}>
                {authMode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAuthModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Отмена</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.publishBtn} onPress={handleAuthSubmit} disabled={authLoading}>
                {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.publishBtnText}>{authMode === 'login' ? 'Войти' : 'Создать'}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* МОДАЛЬНОЕ ОКНО СОЗДАНИЯ ПОСТА */}
      <Modal visible={isPostModalOpen} animationType="slide" transparent>
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
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsPostModalOpen(false)} disabled={isPublishing}>
                <Text style={styles.cancelBtnText}>Отмена</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.publishBtn} onPress={handleCreatePost} disabled={isPublishing}>
                {isPublishing ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.publishBtnText}>Опубликовать</Text>}
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
  container: { flex: 1, backgroundColor: '#f4f5f8' },
  header: { height: 56, backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  logoText: { fontSize: 18, fontWeight: '800', color: '#6366f1' },
  createPostBtn: { backgroundColor: '#6366f1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  createPostBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
  authBtn: { borderHeight: 1, borderColor: '#6366f1', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  authBtnText: { color: '#6366f1', fontSize: 12, fontWeight: '600' },
  userBadgeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16, gap: 4 },
  miniAvatar: { width: 22, height: 22, borderRadius: 11 },
  miniUsername: { fontSize: 12, fontWeight: '600', color: '#374151' },
  feedScroll: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: '#6b7280', fontSize: 14 },
  errorText: { color: '#ef4444', textAlign: 'center', marginBottom: 12, fontSize: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 4 },
  emptySub: { color: '#6b7280', fontSize: 14, marginBottom: 16, textAlign: 'center' },
  retryBtn: { backgroundColor: '#6366f1', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: '#ffffff', fontWeight: '600' },
  postCard: { backgroundColor: '#ffffff', marginBottom: 10, padding: 14, borderRadius: 12, marginHorizontal: 8, marginTop: 8 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  authorAvatar: { width: 42, height: 42, borderRadius: 21, marginRight: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5, position: 'absolute', bottom: 0, right: 10, borderWidth: 2, borderColor: '#fff' },
  statusDotLarge: { width: 16, height: 16, borderRadius: 8, position: 'absolute', bottom: 2, right: 2, borderWidth: 3, borderColor: '#fff' },
  postHeaderInfo: { justifyContent: 'center' },
  authorName: { fontWeight: '700', fontSize: 15, color: '#1f2937' },
  roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  roleBadgeText: { color: '#ffffff', fontSize: 9, fontWeight: '800' },
  postTime: { fontSize: 12, color: '#9ca3af' },
  postText: { fontSize: 14, color: '#374151', lineHeight: 20, marginBottom: 10 },
  postImage: { width: '100%', height: 200, borderRadius: 10, marginBottom: 10 },
  postActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center' },
  actionIcon: { fontSize: 16, marginRight: 4 },
  actionText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  likedText: { color: '#ef4444', fontWeight: '700' },
  centerTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 4 },
  centerSub: { color: '#6b7280', fontSize: 13, marginBottom: 16 },
  clusterCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#6366f1' },
  clusterCardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6, color: '#111827' },
  clusterDetail: { fontSize: 13, color: '#4b5563', marginBottom: 2 },
  nodeItem: { backgroundColor: '#ffffff', padding: 14, borderRadius: 10, marginBottom: 10 },
  nodeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  nodeIdText: { fontWeight: '700', fontSize: 14, color: '#1f2937' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  statusBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  nodeSub: { fontSize: 12, color: '#6b7280' },
  profileName: { fontSize: 20, fontWeight: '800', color: '#111827' },
  profileUsername: { fontSize: 14, color: '#6b7280', marginBottom: 8 },
  bioBox: { backgroundColor: '#ffffff', padding: 14, borderRadius: 12, width: '100%', marginTop: 12 },
  bioTitle: { fontSize: 13, fontWeight: '700', color: '#4b5563', marginBottom: 4 },
  bioText: { fontSize: 14, color: '#1f2937' },
  roleTestCard: { backgroundColor: '#ffffff', padding: 14, borderRadius: 12, width: '100%', marginTop: 12 },
  roleTestTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  roleTestSub: { fontSize: 12, color: '#6b7280', marginBottom: 10 },
  roleBtnGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roleSelectBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, backgroundColor: '#f9fafb' },
  roleSelectBtnActive: { backgroundColor: '#6366f1' },
  roleSelectText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  roleSelectTextActive: { color: '#ffffff' },
  logoutBtn: { marginTop: 20, padding: 12, backgroundColor: '#fee2e2', borderRadius: 8, width: '100%', alignItems: 'center' },
  logoutBtnText: { color: '#ef4444', fontWeight: '700' },
  navBar: { height: 60, backgroundColor: '#ffffff', flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIcon: { fontSize: 18, opacity: 0.5 },
  navActive: { opacity: 1 },
  navLabel: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
  navLabelActive: { color: '#6366f1', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: '#1f2937' },
  textInput: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, textAlignVertical: 'top', fontSize: 14, marginBottom: 12 },
  singleInput: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  cancelBtnText: { color: '#6b7280', fontWeight: '600' },
  publishBtn: { backgroundColor: '#6366f1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, minWidth: 100, alignItems: 'center' },
  publishBtnText: { color: '#ffffff', fontWeight: '600' },
});