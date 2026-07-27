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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Language } from './i18n';
import {
  fetchPosts,
  createPost,
  togglePostLike,
  fetchClusterNodes,
  registerUser,
  loginUser,
  updateUserRole,
  setAuthToken,
  fetchCurrentUser,
} from './api';

const FONT_FAMILY = Platform.select({
  ios: '-apple-system',
  android: 'sans-serif',
  web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
});

export default function SocialApp() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [lang, setLang] = useState<Language>('ru');
  const [activeTab, setActiveTab] = useState<'feed' | 'cluster' | 'profile'>('feed');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const t = translations[lang];

  const colors = theme === 'dark'
    ? { bg1: '#0d1117', bg2: '#161b22', border: '#30363d', subtext: '#8b949e', text: '#c9d1d9', accent: '#d66853', success: '#238636' }
    : { bg1: '#ffffff', bg2: '#f6f8fa', border: '#d0d7de', subtext: '#57606a', text: '#24292f', accent: '#d66853', success: '#2da44e' };

  // Auth State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '', firstName: '', lastName: '' });
  const [authLoading, setAuthLoading] = useState(false);

  // Post State
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    const savedLang = await AsyncStorage.getItem('user_lang');
    if (savedLang) setLang(savedLang as Language);

    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      setAuthToken(token);
      try {
        const user = await fetchCurrentUser();
        if (user) setCurrentUser(user);
      } catch (e) {
        await AsyncStorage.removeItem('auth_token');
        setAuthToken(null);
      }
    }
    loadFeed();
  };

  const changeLanguage = async (newLang: Language) => {
    setLang(newLang);
    await AsyncStorage.setItem('user_lang', newLang);
  };

  const loadFeed = async () => {
    setLoading(true);
    try {
      const data = await fetchPosts();
      setPosts(data);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg(t.errorConnect);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSubmit = async () => {
    if (!authForm.username || !authForm.password || (authMode === 'register' && !authForm.firstName)) {
      Alert.alert('Error', 'Please fill required fields');
      return;
    }
    setAuthLoading(true);
    try {
      const res = authMode === 'login' 
        ? await loginUser({ username: authForm.username, password: authForm.password })
        : await registerUser(authForm);
      
      setAuthToken(res.token);
      await AsyncStorage.setItem('auth_token', res.token);
      setCurrentUser(res.user);
      setIsAuthModalOpen(false);
      loadFeed();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Auth failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    setAuthToken(null);
    await AsyncStorage.removeItem('auth_token');
    setCurrentUser(null);
  };

  const handleCreatePost = async () => {
    if (!currentUser) return setIsAuthModalOpen(true);
    if (!newContent.trim()) return;
    setIsPublishing(true);
    try {
      const created = await createPost(newContent);
      setPosts((prev) => [created, ...prev]);
      setNewContent('');
      setIsPostModalOpen(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg1 }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bg2, borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[styles.logoBadge, { backgroundColor: colors.accent }]}>
            <Octicons name="terminal" size={16} color="#ffffff" />
          </View>
          <Text style={[styles.brandTitle, { color: colors.text, fontFamily: FONT_FAMILY }]}>Z</Text>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity style={[styles.iconBtn, { borderColor: colors.border }]} onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            <Octicons name={theme === 'dark' ? 'sun' : 'moon'} size={14} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.langBtn, { borderColor: colors.border }]} onPress={() => changeLanguage(lang === 'ru' ? 'en' : 'ru')}>
            <Text style={{ color: colors.text, fontSize: 10, fontWeight: '800' }}>{lang.toUpperCase()}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.success }]} onPress={() => setIsPostModalOpen(true)}>
            <Octicons name="plus" size={14} color="#ffffff" style={{ marginRight: 4 }} />
            <Text style={[styles.createBtnText, { fontFamily: FONT_FAMILY }]}>{t.newPost}</Text>
          </TouchableOpacity>

          {currentUser ? (
            <TouchableOpacity onPress={() => setActiveTab('profile')}>
              <Image source={{ uri: currentUser.avatar }} style={styles.avatarMini} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.loginBtn, { borderColor: colors.border }]} onPress={() => setIsAuthModalOpen(true)}>
              <Text style={[styles.loginBtnText, { color: colors.text, fontFamily: FONT_FAMILY }]}>{t.signIn}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {activeTab === 'feed' && (
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accent} />
              <Text style={{ color: colors.subtext, marginTop: 10 }}>{t.loading}</Text>
            </View>
          ) : errorMsg ? (
            <View style={styles.center}>
              <Text style={{ color: colors.accent, marginBottom: 10 }}>{errorMsg}</Text>
              <TouchableOpacity onPress={loadFeed} style={[styles.retryBtn, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                <Text style={{ color: colors.text }}>{t.retry}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            posts.map((post) => (
              <View key={post.id} style={[styles.card, { borderBottomColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <Image source={{ uri: post.author.avatar }} style={styles.authorImg} />
                  <View>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{post.author.name}</Text>
                    <Text style={{ color: colors.subtext, fontSize: 12 }}>@{post.author.username}</Text>
                  </View>
                </View>
                <Text style={{ color: colors.text, marginTop: 8, lineHeight: 20 }}>{post.content}</Text>
              </View>
            ))
          )
        )}

        {activeTab === 'cluster' && (
          <View style={{ padding: 16 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{t.cluster}</Text>
            <Text style={{ color: colors.subtext, marginBottom: 20 }}>{t.realTimeStatus}</Text>
            <View style={[styles.nodeBox, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{t.centralNode}</Text>
              <Text style={{ color: colors.success }}>{t.operational}</Text>
            </View>
          </View>
        )}

        {activeTab === 'profile' && (
          <View style={{ padding: 16 }}>
            {currentUser ? (
              <>
                <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', marginBottom: 20 }}>
                  <Image source={{ uri: currentUser.avatar }} style={styles.profileImg} />
                  <View>
                    <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{currentUser.firstName}</Text>
                    <Text style={{ color: colors.subtext }}>@{currentUser.username}</Text>
                  </View>
                </View>
                <View style={[styles.nodeBox, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                  <Text style={{ color: colors.subtext, fontSize: 10, fontWeight: '800' }}>{t.encryptedBio}</Text>
                  <Text style={{ color: colors.text }}>{currentUser.bio || t.noBio}</Text>
                </View>
                <TouchableOpacity onPress={handleLogout} style={[styles.logoutBtn, { borderColor: colors.accent }]}>
                  <Text style={{ color: colors.accent }}>{t.signOut}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.center}>
                <Text style={{ color: colors.text }}>{t.guestMode}</Text>
                <TouchableOpacity onPress={() => setIsAuthModalOpen(true)} style={[styles.retryBtn, { backgroundColor: colors.success }]}>
                  <Text style={{ color: '#fff' }}>{t.signIn}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Auth Modal */}
      <Modal visible={isAuthModalOpen} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={[styles.modalBox, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>{authMode === 'login' ? t.signIn : t.join}</Text>
              <TouchableOpacity onPress={() => setIsAuthModalOpen(false)}><Octicons name="x" size={20} color={colors.subtext} /></TouchableOpacity>
            </View>
            
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.text }]} placeholder={t.username} placeholderTextColor={colors.subtext} value={authForm.username} onChangeText={v => setAuthForm({...authForm, username: v})} autoCapitalize="none" />
            {authMode === 'register' && (
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.text }]} placeholder={t.firstName} placeholderTextColor={colors.subtext} value={authForm.firstName} onChangeText={v => setAuthForm({...authForm, firstName: v})} />
            )}
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.text }]} placeholder={t.password} placeholderTextColor={colors.subtext} secureTextEntry value={authForm.password} onChangeText={v => setAuthForm({...authForm, password: v})} />
            
            <TouchableOpacity onPress={handleAuthSubmit} style={[styles.submitBtn, { backgroundColor: colors.success }]}>
              {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>{authMode === 'login' ? t.signIn : t.createAccount}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
              <Text style={{ color: colors.accent, textAlign: 'center', marginTop: 15 }}>{authMode === 'login' ? t.newToZ : t.alreadyHaveAccount}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Post Modal */}
      <Modal visible={isPostModalOpen} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalBox, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
             <View style={styles.modalHeader}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>{t.newPost}</Text>
              <TouchableOpacity onPress={() => setIsPostModalOpen(false)}><Octicons name="x" size={20} color={colors.subtext} /></TouchableOpacity>
            </View>
            <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top', borderColor: colors.border, color: colors.text }]} multiline placeholder={t.whatIsOnYourMind} placeholderTextColor={colors.subtext} value={newContent} onChangeText={setNewContent} />
            <TouchableOpacity onPress={handleCreatePost} style={[styles.submitBtn, { backgroundColor: colors.success }]}>
              {isPublishing ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>{t.post}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Tabs */}
      <View style={[styles.tabs, { backgroundColor: colors.bg2, borderTopColor: colors.border }]}>
        {['feed', 'cluster', 'profile'].map((tab: any) => (
          <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={styles.tabItem}>
            <Octicons name={tab === 'feed' ? 'home' : tab === 'cluster' ? 'browser' : 'person'} size={20} color={activeTab === tab ? colors.accent : colors.subtext} />
            <Text style={{ fontSize: 10, color: activeTab === tab ? colors.accent : colors.subtext }}>{t[tab as keyof typeof t]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1 },
  logoBadge: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  brandTitle: { fontSize: 20, fontWeight: '900' },
  iconBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  langBtn: { paddingHorizontal: 8, height: 34, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  createBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 34, borderRadius: 8 },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  loginBtn: { paddingHorizontal: 12, height: 34, borderRadius: 8, borderWidth: 1, justifyContent: 'center' },
  loginBtnText: { fontWeight: '700', fontSize: 13 },
  avatarMini: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#30363d' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  card: { padding: 16, borderBottomWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  authorImg: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#30363d' },
  nodeBox: { padding: 16, borderRadius: 8, borderWidth: 1, marginBottom: 16 },
  profileImg: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#30363d' },
  logoutBtn: { height: 44, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalBox: { borderRadius: 12, borderWidth: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 15 },
  submitBtn: { height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  tabs: { height: 65, flexDirection: 'row', borderTopWidth: 1 },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4 },
});