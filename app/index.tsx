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
  Platform,
} from 'react-native';
import { Octicons } from '@expo/vector-icons';
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

// GitHub-like font stack
const FONT_FAMILY = Platform.select({
  ios: '-apple-system',
  android: 'sans-serif',
  web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
});

export default function SocialApp() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<'feed' | 'cluster' | 'profile'>('feed');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const colors = theme === 'dark'
    ? {
        bg1: '#0d1117', // GitHub dark mode background
        bg2: '#161b22',
        border: '#30363d',
        subtext: '#8b949e',
        text: '#c9d1d9',
        accent: '#d66853',
        success: '#238636',
      }
    : {
        bg1: '#ffffff',
        bg2: '#f6f8fa',
        border: '#d0d7de',
        subtext: '#57606a',
        text: '#24292f',
        accent: '#d66853',
        success: '#2da44e',
      };

  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

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
      setErrorMsg('Не удалось подключиться к серверу Z');
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
    if (!newContent.trim()) return;

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
            <Octicons name="terminal" size={16} color="#ffffff" />
          </View>
          <Text style={[styles.brandTitle, { color: colors.text, fontFamily: FONT_FAMILY }]}>Z</Text>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            style={[styles.iconThemeBtn, { borderColor: colors.border }]}
            onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Octicons name={theme === 'dark' ? 'sun' : 'moon'} size={14} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.createPostBtn, { backgroundColor: colors.success }]}
            onPress={() => setIsPostModalOpen(true)}
          >
            <Octicons name="plus" size={14} color="#ffffff" style={{ marginRight: 4 }} />
            <Text style={[styles.createPostBtnText, { fontFamily: FONT_FAMILY }]}>New</Text>
          </TouchableOpacity>

          {currentUser ? (
            <TouchableOpacity
              onPress={() => setActiveTab('profile')}
            >
              <Image source={{ uri: currentUser.avatar }} style={styles.miniAvatar} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.authBtn, { borderColor: colors.border }]}
              onPress={() => setIsAuthModalOpen(true)}
            >
              <Text style={[styles.authBtnText, { color: colors.text, fontFamily: FONT_FAMILY }]}>Sign in</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Feed */}
      {activeTab === 'feed' && (
        <View style={{ flex: 1 }}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.subtext, fontFamily: FONT_FAMILY }]}>Loading feed...</Text>
            </View>
          ) : errorMsg ? (
            <View style={styles.centerContainer}>
              <Octicons name="alert" size={24} color={colors.accent} />
              <Text style={[styles.errorText, { color: colors.accent, fontFamily: FONT_FAMILY, marginTop: 10 }]}>{errorMsg}</Text>
              <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.bg2, borderColor: colors.border, borderWidth: 1 }]} onPress={loadFeed}>
                <Text style={[styles.retryBtnText, { color: colors.text, fontFamily: FONT_FAMILY }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={styles.feedScroll} showsVerticalScrollIndicator={false}>
              {posts.map((post) => (
                <View
                  key={post.id}
                  style={[styles.postCard, { backgroundColor: colors.bg1, borderBottomColor: colors.border }]}
                >
                  <View style={styles.postHeader}>
                    <Image
                      source={{ uri: post.author.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150' }}
                      style={styles.authorAvatar}
                    />
                    <View style={styles.postHeaderInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.authorName, { color: colors.text, fontFamily: FONT_FAMILY }]}>{post.author.name}</Text>
                        <Text style={[styles.postTime, { color: colors.subtext, fontFamily: FONT_FAMILY }]}>@{post.author.username}</Text>
                        {post.author.role && post.author.role !== 'user' && (
                          <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[post.author.role] || colors.accent }]}>
                            <Text style={styles.roleBadgeText}>{post.author.role}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.postTime, { color: colors.subtext, fontSize: 11, fontFamily: FONT_FAMILY }]}>
                        {new Date(post.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.postText, { color: colors.text, fontFamily: FONT_FAMILY }]}>{post.content}</Text>

                  {post.image && (
                    <Image source={{ uri: post.image }} style={styles.postImage} resizeMode="cover" />
                  )}

                  <View style={styles.postActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(post.id)}>
                      <Octicons name={post.isLiked ? "heart-fill" : "heart"} size={14} color={post.isLiked ? colors.accent : colors.subtext} />
                      <Text style={[styles.actionText, { color: post.isLiked ? colors.accent : colors.subtext, fontFamily: FONT_FAMILY }]}>
                        {post.likes}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn}>
                      <Octicons name="comment" size={14} color={colors.subtext} />
                      <Text style={[styles.actionText, { color: colors.subtext, fontFamily: FONT_FAMILY }]}>0</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Cluster */}
      {activeTab === 'cluster' && (
        <ScrollView style={styles.feedScroll} contentContainerStyle={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Octicons name="globe" size={18} color={colors.text} />
            <Text style={[styles.centerTitle, { color: colors.text, fontFamily: FONT_FAMILY }]}>Z-Mesh Cluster</Text>
          </View>
          <Text style={[styles.centerSub, { color: colors.subtext, fontFamily: FONT_FAMILY }]}>
            Real-time status of decentralized network nodes.
          </Text>

          <View style={[styles.clusterCard, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Octicons name="server" size={14} color={colors.accent} />
              <Text style={[styles.clusterCardTitle, { color: colors.text, fontFamily: FONT_FAMILY }]}>Central Node</Text>
            </View>
            <Text style={[styles.clusterDetail, { color: colors.subtext, fontFamily: FONT_FAMILY }]}>Status: Operational</Text>
            <Text style={[styles.clusterDetail, { color: colors.subtext, fontFamily: FONT_FAMILY }]}>Protocol: Z-Sync v1.0</Text>
          </View>

          {nodes.map((node, index) => (
            <View key={node.nodeId || index} style={[styles.nodeItem, { backgroundColor: colors.bg1, borderColor: colors.border }]}>
              <View style={styles.nodeHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Octicons name="cpu" size={14} color={colors.subtext} />
                  <Text style={[styles.nodeIdText, { color: colors.text, fontFamily: FONT_FAMILY }]}>{node.nodeId}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: node.status === 'active' ? colors.success : colors.subtext }]}>
                  <Text style={styles.statusBadgeText}>{node.status.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={[styles.nodeSub, { color: colors.subtext, fontFamily: FONT_FAMILY }]}>Sync: {node.dbSyncProgress}%</Text>
              <Text style={[styles.nodeSub, { color: colors.subtext, fontFamily: FONT_FAMILY }]}>Host: {node.url}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Profile */}
      {activeTab === 'profile' && (
        <ScrollView style={{ flex: 1, padding: 16 }}>
          {currentUser ? (
            <View style={{ alignItems: 'flex-start' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <Image source={{ uri: currentUser.avatar }} style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: colors.border }} />
                <View>
                  <Text style={[styles.profileName, { color: colors.text, fontFamily: FONT_FAMILY }]}>{currentUser.firstName} {currentUser.lastName || ''}</Text>
                  <Text style={[styles.profileUsername, { color: colors.subtext, fontFamily: FONT_FAMILY }]}>@{currentUser.username}</Text>
                  <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[currentUser.role] || colors.accent, alignSelf: 'flex-start', marginTop: 4 }]}>
                    <Text style={styles.roleBadgeText}>{currentUser.role}</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.bioBox, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Octicons name="shield-lock" size={14} color={colors.subtext} />
                  <Text style={[styles.bioTitle, { color: colors.subtext, fontFamily: FONT_FAMILY }]}>ENCRYPTED BIO</Text>
                </View>
                <Text style={[styles.bioText, { color: colors.text, fontFamily: FONT_FAMILY }]}>{currentUser.bio || 'No bio provided.'}</Text>
              </View>

              <View style={[styles.roleTestCard, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                <Text style={[styles.roleTestTitle, { color: colors.text, fontFamily: FONT_FAMILY }]}>Settings</Text>
                <View style={styles.roleBtnGrid}>
                  {['user', 'root', 'admin', 'moderator', 'tester', 'helper'].map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.roleSelectBtn,
                        {
                          backgroundColor: currentUser.role === r ? colors.bg1 : 'transparent',
                          borderColor: colors.border,
                        }
                      ]}
                      onPress={() => handleRoleChange(r)}
                    >
                      <Text style={[styles.roleSelectText, { color: currentUser.role === r ? colors.accent : colors.text, fontFamily: FONT_FAMILY }]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.logoutBtn, { borderColor: colors.accent, marginTop: 24 }]}
                onPress={() => {
                  setAuthToken(null);
                  setCurrentUser(null);
                }}
              >
                <Octicons name="sign-out" size={14} color={colors.accent} style={{ marginRight: 6 }} />
                <Text style={[styles.logoutBtnText, { color: colors.accent, fontFamily: FONT_FAMILY }]}>Sign out</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.centerContainer}>
              <Octicons name="person" size={48} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: FONT_FAMILY, marginTop: 16 }]}>Guest Mode</Text>
              <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.success }]} onPress={() => setIsAuthModalOpen(true)}>
                <Text style={[styles.retryBtnText, { color: '#ffffff', fontFamily: FONT_FAMILY }]}>Sign in to Z</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Auth Modal */}
      <Modal visible={isAuthModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: FONT_FAMILY }]}>
                {authMode === 'login' ? 'Sign in to Z' : 'Join Z network'}
              </Text>
              <TouchableOpacity onPress={() => setIsAuthModalOpen(false)}>
                <Octicons name="x" size={20} color={colors.subtext} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.singleInput, { backgroundColor: colors.bg1, borderColor: colors.border, color: colors.text, fontFamily: FONT_FAMILY }]}
              placeholder="Username"
              placeholderTextColor={colors.subtext}
              value={authForm.username}
              onChangeText={(t) => setAuthForm({ ...authForm, username: t })}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.singleInput, { backgroundColor: colors.bg1, borderColor: colors.border, color: colors.text, fontFamily: FONT_FAMILY }]}
              placeholder="Password"
              placeholderTextColor={colors.subtext}
              secureTextEntry
              value={authForm.password}
              onChangeText={(t) => setAuthForm({ ...authForm, password: t })}
            />

            <TouchableOpacity style={[styles.publishBtn, { backgroundColor: colors.success, width: '100%', marginBottom: 12 }]} onPress={handleAuthSubmit}>
              {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.publishBtnText, { fontFamily: FONT_FAMILY }]}>{authMode === 'login' ? 'Sign in' : 'Create account'}</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
              <Text style={{ color: colors.accent, textAlign: 'center', fontSize: 13, fontFamily: FONT_FAMILY }}>
                {authMode === 'login' ? "New to Z? Create an account." : "Already have an account? Sign in."}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Post Modal */}
      <Modal visible={isPostModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: FONT_FAMILY }]}>Create new post</Text>
              <TouchableOpacity onPress={() => setIsPostModalOpen(false)}>
                <Octicons name="x" size={20} color={colors.subtext} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.textInput, { backgroundColor: colors.bg1, borderColor: colors.border, color: colors.text, fontFamily: FONT_FAMILY, minHeight: 120 }]}
              placeholder="What's on your mind?"
              placeholderTextColor={colors.subtext}
              multiline
              value={newContent}
              onChangeText={setNewContent}
            />

            <TouchableOpacity 
              style={[styles.publishBtn, { backgroundColor: colors.success, alignSelf: 'flex-end' }]} 
              onPress={handleCreatePost}
              disabled={isPublishing}
            >
              {isPublishing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[styles.publishBtnText, { fontFamily: FONT_FAMILY }]}>Post</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* NavBar */}
      <View style={[styles.navBar, { backgroundColor: colors.bg2, borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('feed')}>
          <Octicons name="home" size={20} color={activeTab === 'feed' ? colors.accent : colors.subtext} />
          <Text style={[styles.navLabel, { color: activeTab === 'feed' ? colors.accent : colors.subtext, fontFamily: FONT_FAMILY }]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('cluster')}>
          <Octicons name="browser" size={20} color={activeTab === 'cluster' ? colors.accent : colors.subtext} />
          <Text style={[styles.navLabel, { color: activeTab === 'cluster' ? colors.accent : colors.subtext, fontFamily: FONT_FAMILY }]}>Cluster</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('profile')}>
          <Octicons name="person" size={20} color={activeTab === 'profile' ? colors.accent : colors.subtext} />
          <Text style={[styles.navLabel, { color: activeTab === 'profile' ? colors.accent : colors.subtext, fontFamily: FONT_FAMILY }]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1 },
  logoBadge: { width: 30, height: 30, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  brandTitle: { fontSize: 18, fontWeight: '800' },
  iconThemeBtn: { width: 32, height: 32, borderRadius: 6, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  createPostBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  createPostBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
  authBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  authBtnText: { fontSize: 13, fontWeight: '600' },
  miniAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#30363d' },
  feedScroll: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 13 },
  errorText: { textAlign: 'center', fontSize: 14, marginBottom: 16 },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  retryBtnText: { fontWeight: '600', fontSize: 13 },
  postCard: { padding: 16, borderBottomWidth: 1 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  authorAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12, borderWidth: 1, borderColor: '#30363d' },
  postHeaderInfo: { flex: 1 },
  authorName: { fontWeight: '600', fontSize: 14 },
  roleBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 },
  roleBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  postTime: { fontSize: 13 },
  postText: { fontSize: 14, lineHeight: 21, marginBottom: 12 },
  postImage: { width: '100%', height: 240, borderRadius: 6, marginBottom: 12 },
  postActions: { flexDirection: 'row', gap: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 12, fontWeight: '500' },
  centerTitle: { fontSize: 18, fontWeight: '800' },
  centerSub: { fontSize: 13, marginBottom: 20 },
  clusterCard: { padding: 16, borderRadius: 6, borderWidth: 1, marginBottom: 12 },
  clusterCardTitle: { fontSize: 15, fontWeight: '600' },
  clusterDetail: { fontSize: 13, marginBottom: 4 },
  nodeItem: { padding: 16, borderRadius: 6, borderWidth: 1, marginBottom: 8 },
  nodeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  nodeIdText: { fontWeight: '600', fontSize: 14 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  nodeSub: { fontSize: 12, marginBottom: 2 },
  profileName: { fontSize: 20, fontWeight: '700' },
  profileUsername: { fontSize: 15 },
  bioBox: { padding: 16, borderRadius: 6, borderWidth: 1, width: '100%', marginBottom: 16 },
  bioTitle: { fontSize: 10, fontWeight: '800' },
  bioText: { fontSize: 14, lineHeight: 20 },
  roleTestCard: { padding: 16, borderRadius: 6, borderWidth: 1, width: '100%' },
  roleTestTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  roleBtnGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleSelectBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  roleSelectText: { fontSize: 12, fontWeight: '600' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 6, borderWidth: 1, width: '100%', justifyContent: 'center' },
  logoutBtnText: { fontWeight: '600', fontSize: 13 },
  navBar: { height: 60, flexDirection: 'row', borderTopWidth: 1 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  navLabel: { fontSize: 10, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', padding: 16 },
  modalContent: { borderRadius: 12, borderWidth: 1, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  textInput: { borderWidth: 1, borderRadius: 6, padding: 12, textAlignVertical: 'top', fontSize: 14, marginBottom: 16 },
  singleInput: { borderWidth: 1, borderRadius: 6, padding: 12, fontSize: 14, marginBottom: 12 },
  publishBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  publishBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
});