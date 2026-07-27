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
  root: '#d66853',
  admin: '#e07a5f',
  moderator: '#3d405b',
  tester: '#81b29a',
  helper: '#f2cc8f',
};

export default function SocialApp() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<'feed' | 'cluster' | 'profile'>('feed');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Палитра согласно спецификации
  const colors = theme === 'dark'
    ? {
        bg1: '#11151c',
        bg2: '#212d40',
        border: '#364156',
        subtext: '#7e8899',
        text: '#fefcfb',
        accent: '#d66853',
      }
    : {
        bg1: '#fefcfb',
        bg2: '#ededf4',
        border: '#7e8899',
        subtext: '#555d69',
        text: '#11151c',
        accent: '#d66853',
      };

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
      setErrorMsg('Не удалось подключиться к серверу Z (' + API_URL + ')');
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
      Alert.alert('Ошибка', e.message || 'Не удалось отправить запись');
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg1 }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg1} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bg2, borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[styles.logoBadge, { backgroundColor: colors.accent }]}>
            <Text style={styles.logoText}>Z</Text>
          </View>
          <Text style={[styles.brandTitle, { color: colors.text }]}>Z</Text>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Кнопка смены темы */}
          <TouchableOpacity
            style={[styles.iconThemeBtn, { backgroundColor: colors.bg1, borderColor: colors.border }]}
            onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Text style={{ fontSize: 14 }}>{theme === 'dark' ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>

          {currentUser ? (
            <TouchableOpacity
              style={[styles.userBadgeBtn, { backgroundColor: colors.bg1, borderColor: colors.border }]}
              onPress={() => setActiveTab('profile')}
            >
              <Image source={{ uri: currentUser.avatar }} style={styles.miniAvatar} />
              <Text style={[styles.miniUsername, { color: colors.text }]}>@{currentUser.username}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.authBtn, { borderColor: colors.accent }]}
              onPress={() => setIsAuthModalOpen(true)}
            >
              <Text style={[styles.authBtnText, { color: colors.accent }]}>Войти</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.createPostBtn, { backgroundColor: colors.accent }]}
            onPress={() => setIsPostModalOpen(true)}
          >
            <Text style={styles.createPostBtnText}>+ Пост</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ЛЕНТА ПОСТОВ */}
      {activeTab === 'feed' && (
        <View style={{ flex: 1 }}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.subtext }]}>Загрузка записей из Z...</Text>
            </View>
          ) : errorMsg ? (
            <View style={styles.centerContainer}>
              <Text style={[styles.errorText, { color: colors.accent }]}>{errorMsg}</Text>
              <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.accent }]} onPress={loadFeed}>
                <Text style={styles.retryBtnText}>Повторить попытку</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={styles.feedScroll} showsVerticalScrollIndicator={false}>
              {posts.map((post) => (
                <View
                  key={post.id}
                  style={[styles.postCard, { backgroundColor: colors.bg2, borderColor: colors.border }]}
                >
                  <View style={styles.postHeader}>
                    <View style={{ position: 'relative' }}>
                      <Image
                        source={{ uri: post.author.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150' }}
                        style={styles.authorAvatar}
                      />
                      <View style={[styles.statusDot, { backgroundColor: post.author.status === 'online' ? '#10b981' : colors.subtext, borderColor: colors.bg2 }]} />
                    </View>

                    <View style={styles.postHeaderInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.authorName, { color: colors.text }]}>{post.author.name}</Text>
                        
                        {post.author.role && post.author.role !== 'user' && (
                          <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[post.author.role] || colors.accent }]}>
                            <Text style={styles.roleBadgeText}>{post.author.role.toUpperCase()}</Text>
                          </View>
                        )}
                      </View>
                      
                      <Text style={[styles.postTime, { color: colors.subtext }]}>@{post.author.username} • {new Date(post.createdAt).toLocaleTimeString()}</Text>
                    </View>
                  </View>

                  <Text style={[styles.postText, { color: colors.text }]}>{post.content}</Text>

                  {post.image && (
                    <Image source={{ uri: post.image }} style={styles.postImage} resizeMode="cover" />
                  )}

                  <View style={[styles.postActions, { borderTopColor: colors.border }]}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(post.id)}>
                      <Text style={styles.actionIcon}>{post.isLiked ? '❤️' : '🤍'}</Text>
                      <Text style={[styles.actionText, { color: post.isLiked ? colors.accent : colors.subtext }]}>
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

      {/* MESH CLUSTER (СЕТЬ НОД Z) */}
      {activeTab === 'cluster' && (
        <ScrollView style={styles.feedScroll} contentContainerStyle={{ padding: 16 }}>
          <Text style={[styles.centerTitle, { color: colors.text }]}>🌐 Сеть нод Z</Text>
          <Text style={[styles.centerSub, { color: colors.subtext }]}>
            Мониторинг децентрализованных узлов сети и репликации БД.
          </Text>

          <View style={[styles.clusterCard, { backgroundColor: colors.bg2, borderColor: colors.accent }]}>
            <Text style={[styles.clusterCardTitle, { color: colors.text }]}>Центральный узел VPS</Text>
            <Text style={[styles.clusterDetail, { color: colors.subtext }]}>IP: 82.26.152.225</Text>
            <Text style={[styles.clusterDetail, { color: colors.subtext }]}>API Бэкенда: Port 4000</Text>
            <Text style={[styles.clusterDetail, { color: colors.subtext }]}>PostgreSQL: Port 5435</Text>
            <Text style={[styles.clusterDetail, { color: colors.subtext }]}>Redis: Port 6453</Text>
          </View>

          <Text style={{ fontSize: 15, fontWeight: '700', marginTop: 18, marginBottom: 10, color: colors.text }}>
            Активные ноды сети ({nodes.length}):
          </Text>

          {nodes.length === 0 ? (
            <Text style={{ color: colors.subtext, marginTop: 8 }}>Ноды не зарегистрированы.</Text>
          ) : (
            nodes.map((node, index) => (
              <View key={node.nodeId || index} style={[styles.nodeItem, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                <View style={styles.nodeHeader}>
                  <Text style={[styles.nodeIdText, { color: colors.text }]}>{node.nodeId}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: colors.accent }]}>
                    <Text style={styles.statusBadgeText}>{node.isMaster ? 'MASTER' : 'REPLICA'}</Text>
                  </View>
                </View>
                <Text style={[styles.nodeSub, { color: colors.subtext }]}>Синхронизация БД: {node.dbSyncProgress}%</Text>
                <Text style={[styles.nodeSub, { color: colors.subtext }]}>Статус: {node.status.toUpperCase()}</Text>
                <Text style={[styles.nodeSub, { color: colors.subtext }]}>URL: {node.url}</Text>
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
                <Image source={{ uri: currentUser.avatar }} style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: colors.border }} />
                <View style={[styles.statusDotLarge, { backgroundColor: currentUser.status === 'online' ? '#10b981' : colors.subtext, borderColor: colors.bg1 }]} />
              </View>

              <Text style={[styles.profileName, { color: colors.text }]}>{currentUser.firstName} {currentUser.lastName || ''}</Text>
              <Text style={[styles.profileUsername, { color: colors.subtext }]}>@{currentUser.username}</Text>

              {currentUser.role && currentUser.role !== 'user' && (
                <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[currentUser.role] || colors.accent, marginTop: 6, paddingHorizontal: 12, paddingVertical: 4 }]}>
                  <Text style={[styles.roleBadgeText, { fontSize: 11 }]}>{currentUser.role.toUpperCase()}</Text>
                </View>
              )}

              {/* Био */}
              <View style={[styles.bioBox, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                <Text style={[styles.bioTitle, { color: colors.subtext }]}>🔒 Описание (Шифрование AES-256):</Text>
                <Text style={[styles.bioText, { color: colors.text }]}>{currentUser.bio || 'Описание отсутствует'}</Text>
              </View>

              {/* Соцсети */}
              {currentUser.socialLinks && (
                <View style={[styles.bioBox, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                  <Text style={[styles.bioTitle, { color: colors.subtext }]}>🌐 Ссылки на соцсети:</Text>
                  <Text style={[styles.bioText, { color: colors.text }]}>{currentUser.socialLinks}</Text>
                </View>
              )}

              {/* Смена роли */}
              <View style={[styles.roleTestCard, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                <Text style={[styles.roleTestTitle, { color: colors.text }]}>⚙️ Переключение роли:</Text>
                <Text style={[styles.roleTestSub, { color: colors.subtext }]}>Стандартная роль "user" не выводится в бейдже.</Text>
                <View style={styles.roleBtnGrid}>
                  {['user', 'root', 'admin', 'moderator', 'tester', 'helper'].map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.roleSelectBtn,
                        {
                          backgroundColor: currentUser.role === r ? colors.accent : colors.bg1,
                          borderColor: currentUser.role === r ? colors.accent : colors.border,
                        }
                      ]}
                      onPress={() => handleRoleChange(r)}
                    >
                      <Text style={[styles.roleSelectText, { color: currentUser.role === r ? '#ffffff' : colors.text }]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.logoutBtn, { borderColor: colors.accent }]}
                onPress={() => {
                  setAuthToken(null);
                  setCurrentUser(null);
                  Alert.alert('Выход', 'Вы вышли из учетной записи Z');
                }}
              >
                <Text style={[styles.logoutBtnText, { color: colors.accent }]}>Выйти из аккаунта</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.centerContainer}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Вы не авторизованы</Text>
              <Text style={[styles.emptySub, { color: colors.subtext }]}>Войдите в систему Z для доступа к профилю</Text>
              <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.accent }]} onPress={() => setIsAuthModalOpen(true)}>
                <Text style={styles.retryBtnText}>Войти в аккаунт</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* МОДАЛЬНОЕ ОКНО АВТОРИЗАЦИИ / РЕГИСТРАЦИИ */}
      <Modal visible={isAuthModalOpen} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={[styles.modalContent, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{authMode === 'login' ? 'Вход в Z' : 'Регистрация в Z'}</Text>

            <TextInput
              style={[styles.singleInput, { backgroundColor: colors.bg1, borderColor: colors.border, color: colors.text }]}
              placeholder="Логин (username)"
              placeholderTextColor={colors.subtext}
              value={authForm.username}
              onChangeText={(t) => setAuthForm({ ...authForm, username: t })}
              autoCapitalize="none"
            />

            <TextInput
              style={[styles.singleInput, { backgroundColor: colors.bg1, borderColor: colors.border, color: colors.text }]}
              placeholder="Пароль"
              placeholderTextColor={colors.subtext}
              secureTextEntry
              value={authForm.password}
              onChangeText={(t) => setAuthForm({ ...authForm, password: t })}
            />

            {authMode === 'register' && (
              <>
                <TextInput
                  style={[styles.singleInput, { backgroundColor: colors.bg1, borderColor: colors.border, color: colors.text }]}
                  placeholder="Имя"
                  placeholderTextColor={colors.subtext}
                  value={authForm.firstName}
                  onChangeText={(t) => setAuthForm({ ...authForm, firstName: t })}
                />

                <TextInput
                  style={[styles.singleInput, { backgroundColor: colors.bg1, borderColor: colors.border, color: colors.text }]}
                  placeholder="Фамилия (необязательно)"
                  placeholderTextColor={colors.subtext}
                  value={authForm.lastName}
                  onChangeText={(t) => setAuthForm({ ...authForm, lastName: t })}
                />

                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.bg1, borderColor: colors.border, color: colors.text }]}
                  placeholder="Описание профиля (зашифровано)"
                  placeholderTextColor={colors.subtext}
                  maxLength={256}
                  multiline
                  value={authForm.bio}
                  onChangeText={(t) => setAuthForm({ ...authForm, bio: t })}
                />

                <TextInput
                  style={[styles.singleInput, { backgroundColor: colors.bg1, borderColor: colors.border, color: colors.text }]}
                  placeholder="Ссылки на соцсети"
                  placeholderTextColor={colors.subtext}
                  value={authForm.socialLinks}
                  onChangeText={(t) => setAuthForm({ ...authForm, socialLinks: t })}
                />
              </>
            )}

            <TouchableOpacity style={{ marginBottom: 16 }} onPress={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
              <Text style={{ color: colors.accent, textAlign: 'center', fontSize: 13, fontWeight: '600' }}>
                {authMode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAuthModalOpen(false)}>
                <Text style={[styles.cancelBtnText, { color: colors.subtext }]}>Отмена</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.publishBtn, { backgroundColor: colors.accent }]} onPress={handleAuthSubmit} disabled={authLoading}>
                {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.publishBtnText}>{authMode === 'login' ? 'Войти' : 'Создать'}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* МОДАЛЬНОЕ ОКНО СОЗДАНИЯ ПОСТА */}
      <Modal visible={isPostModalOpen} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Новая запись в Z</Text>

            <TextInput
              style={[styles.textInput, { backgroundColor: colors.bg1, borderColor: colors.border, color: colors.text }]}
              placeholder="Что у вас нового?"
              placeholderTextColor={colors.subtext}
              multiline
              numberOfLines={4}
              value={newContent}
              onChangeText={setNewContent}
            />

            <TextInput
              style={[styles.singleInput, { backgroundColor: colors.bg1, borderColor: colors.border, color: colors.text }]}
              placeholder="Ссылка на изображение (необязательно)"
              placeholderTextColor={colors.subtext}
              value={newImageUrl}
              onChangeText={setNewImageUrl}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsPostModalOpen(false)} disabled={isPublishing}>
                <Text style={[styles.cancelBtnText, { color: colors.subtext }]}>Отмена</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.publishBtn, { backgroundColor: colors.accent }]} onPress={handleCreatePost} disabled={isPublishing}>
                {isPublishing ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.publishBtnText}>Опубликовать</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Навигация */}
      <View style={[styles.navBar, { backgroundColor: colors.bg2, borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('feed')}>
          <Text style={[styles.navIcon, activeTab === 'feed' && { opacity: 1 }]}>🏠</Text>
          <Text style={[styles.navLabel, { color: activeTab === 'feed' ? colors.accent : colors.subtext }]}>Лента</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('cluster')}>
          <Text style={[styles.navIcon, activeTab === 'cluster' && { opacity: 1 }]}>🌐</Text>
          <Text style={[styles.navLabel, { color: activeTab === 'cluster' ? colors.accent : colors.subtext }]}>Ноды Z</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('profile')}>
          <Text style={[styles.navIcon, activeTab === 'profile' && { opacity: 1 }]}>👤</Text>
          <Text style={[styles.navLabel, { color: activeTab === 'profile' ? colors.accent : colors.subtext }]}>Профиль</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1 },
  logoBadge: { width: 26, height: 26, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#ffffff', fontWeight: '900', fontSize: 16 },
  brandTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  iconThemeBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  createPostBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  createPostBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
  authBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  authBtnText: { fontSize: 12, fontWeight: '700' },
  userBadgeBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, gap: 6 },
  miniAvatar: { width: 20, height: 20, borderRadius: 10 },
  miniUsername: { fontSize: 12, fontWeight: '600' },
  feedScroll: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 13 },
  errorText: { textAlign: 'center', marginBottom: 12, fontSize: 13 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  emptySub: { fontSize: 13, marginBottom: 16, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  retryBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  postCard: { marginBottom: 10, padding: 14, borderRadius: 10, borderWidth: 1, marginHorizontal: 10, marginTop: 10 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  authorAvatar: { width: 40, height: 40, borderRadius: 8, marginRight: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4, position: 'absolute', bottom: -2, right: 8, borderWidth: 1 },
  statusDotLarge: { width: 14, height: 14, borderRadius: 7, position: 'absolute', bottom: 2, right: 2, borderWidth: 2 },
  postHeaderInfo: { justifyContent: 'center' },
  authorName: { fontWeight: '700', fontSize: 14 },
  roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  roleBadgeText: { color: '#ffffff', fontSize: 9, fontWeight: '800' },
  postTime: { fontSize: 11, marginTop: 1 },
  postText: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  postImage: { width: '100%', height: 210, borderRadius: 8, marginBottom: 10 },
  postActions: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center' },
  actionIcon: { fontSize: 15, marginRight: 4 },
  actionText: { fontSize: 12, fontWeight: '600' },
  centerTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  centerSub: { fontSize: 12, marginBottom: 16 },
  clusterCard: { padding: 14, borderRadius: 10, borderLeftWidth: 4, marginBottom: 10 },
  clusterCardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  clusterDetail: { fontSize: 12, marginBottom: 2 },
  nodeItem: { padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 8 },
  nodeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  nodeIdText: { fontWeight: '700', fontSize: 13 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusBadgeText: { color: '#ffffff', fontSize: 9, fontWeight: '800' },
  nodeSub: { fontSize: 11 },
  profileName: { fontSize: 18, fontWeight: '800' },
  profileUsername: { fontSize: 13, marginBottom: 6 },
  bioBox: { padding: 12, borderRadius: 8, borderWidth: 1, width: '100%', marginTop: 10 },
  bioTitle: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  bioText: { fontSize: 13 },
  roleTestCard: { padding: 12, borderRadius: 8, borderWidth: 1, width: '100%', marginTop: 10 },
  roleTestTitle: { fontSize: 13, fontWeight: '800' },
  roleTestSub: { fontSize: 11, marginBottom: 8 },
  roleBtnGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roleSelectBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1 },
  roleSelectText: { fontSize: 11, fontWeight: '700' },
  logoutBtn: { marginTop: 16, padding: 10, borderRadius: 8, borderWidth: 1, width: '100%', alignItems: 'center' },
  logoutBtnText: { fontWeight: '700', fontSize: 13 },
  navBar: { height: 56, flexDirection: 'row', borderTopWidth: 1 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIcon: { fontSize: 16, opacity: 0.5 },
  navLabel: { fontSize: 10, marginTop: 2, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', padding: 16 },
  modalContent: { borderRadius: 12, borderWidth: 1, padding: 18 },
  modalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 14 },
  textInput: { borderWidth: 1, borderRadius: 8, padding: 10, textAlignVertical: 'top', fontSize: 13, marginBottom: 10 },
  singleInput: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 10 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  cancelBtnText: { fontWeight: '600', fontSize: 13 },
  publishBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 6, minWidth: 90, alignItems: 'center' },
  publishBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
});