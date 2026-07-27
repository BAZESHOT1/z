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
  checkUsername,
  updateProfile,
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
  const [loading, setLoading] = useState<boolean>(true);

  const t = translations[lang];

  const colors = theme === 'dark'
    ? { bg1: '#0d1117', bg2: '#161b22', border: '#30363d', subtext: '#8b949e', text: '#c9d1d9', accent: '#d66853', success: '#238636' }
    : { bg1: '#ffffff', bg2: '#f6f8fa', border: '#d0d7de', subtext: '#57606a', text: '#24292f', accent: '#d66853', success: '#2da44e' };

  // Auth State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [regStep, setRegStep] = useState(1);
  const [showPass, setShowPass] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [authForm, setAuthForm] = useState({ username: '', password: '', confirm: '', email: '' });
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    const savedLang = await AsyncStorage.getItem('user_lang');
    if (savedLang) setLang(savedLang as Language);
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      setAuthToken(token);
      const user = await fetchCurrentUser();
      if (user) setCurrentUser(user);
    }
    loadFeed();
  };

  const loadFeed = async () => {
    setLoading(true);
    try {
      const data = await fetchPosts();
      setPosts(data);
    } catch (err) {} finally { setLoading(false); }
  };

  const handleUsernameCheck = async (val: string) => {
    setAuthForm({ ...authForm, username: val });
    if (val.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    const res = await checkUsername(val);
    setUsernameAvailable(res.available);
  };

  const handleAuthSubmit = async () => {
    if (authMode === 'register' && authForm.password !== authForm.confirm) {
      Alert.alert('Ошибка', 'Пароли не совпадают');
      return;
    }
    setAuthLoading(true);
    try {
      const res = authMode === 'login' 
        ? await loginUser({ username: authForm.username, password: authForm.password })
        : await registerUser({ username: authForm.username, password: authForm.password, email: authForm.email });
      
      setAuthToken(res.token);
      await AsyncStorage.setItem('auth_token', res.token);
      setCurrentUser(res.user);
      setIsAuthModalOpen(false);
      loadFeed();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally { setAuthLoading(false); }
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
          <TouchableOpacity style={[styles.langBtn, { borderColor: colors.border }]} onPress={() => setLang(lang === 'ru' ? 'en' : 'ru')}>
            <Text style={{ color: colors.text, fontSize: 10, fontWeight: '800' }}>{lang.toUpperCase()}</Text>
          </TouchableOpacity>
          {currentUser ? (
            <TouchableOpacity onPress={() => setActiveTab('profile')}>
              <Image source={{ uri: currentUser.avatar }} style={styles.avatarMini} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.loginBtn, { borderColor: colors.border }]} onPress={() => { setAuthMode('login'); setIsAuthModalOpen(true); }}>
              <Text style={[styles.loginBtnText, { color: colors.text, fontFamily: FONT_FAMILY }]}>{t.signIn}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {activeTab === 'feed' && (
          loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} /> : 
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
        )}

        {activeTab === 'cluster' && (
          <View style={{ padding: 20, alignItems: 'center' }}>
            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'root') ? (
               <Text style={{ color: colors.text }}>System Nodes are active.</Text>
            ) : (
               <Text style={{ color: colors.accent }}>Access Restricted to Administrators.</Text>
            )}
          </View>
        )}

        {activeTab === 'profile' && currentUser && (
          <View style={{ padding: 20 }}>
             <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                <Image source={{ uri: currentUser.avatar }} style={styles.profileImg} />
                <View>
                  <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{currentUser.firstName}</Text>
                  <Text style={{ color: colors.subtext }}>@{currentUser.username}</Text>
                </View>
             </View>
             <TouchableOpacity style={[styles.logoutBtn, { borderColor: colors.accent, marginTop: 30 }]} onPress={() => { setAuthToken(null); setCurrentUser(null); AsyncStorage.removeItem('auth_token'); }}>
               <Text style={{ color: colors.accent }}>{t.signOut}</Text>
             </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Improved Linear Auth Modal */}
      <Modal visible={isAuthModalOpen} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={[styles.modalBox, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>{authMode === 'login' ? t.signIn : `${t.join} - Шаг ${regStep}/3`}</Text>
              <TouchableOpacity onPress={() => setIsAuthModalOpen(false)}><Octicons name="x" size={20} color={colors.subtext} /></TouchableOpacity>
            </View>

            {authMode === 'login' ? (
              <>
                <TextInput style={[styles.input, { borderColor: colors.border, color: colors.text }]} placeholder={t.username} placeholderTextColor={colors.subtext} value={authForm.username} onChangeText={v => setAuthForm({...authForm, username: v})} autoCapitalize="none" />
                <TextInput style={[styles.input, { borderColor: colors.border, color: colors.text }]} placeholder={t.password} placeholderTextColor={colors.subtext} secureTextEntry value={authForm.password} onChangeText={v => setAuthForm({...authForm, password: v})} />
                <TouchableOpacity onPress={handleAuthSubmit} style={[styles.submitBtn, { backgroundColor: colors.success }]}>
                  {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>{t.signIn}</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {regStep === 1 && (
                  <View>
                    <TextInput style={[styles.input, { borderColor: usernameAvailable === false ? '#f85149' : colors.border, color: colors.text }]} placeholder={t.username} placeholderTextColor={colors.subtext} value={authForm.username} onChangeText={handleUsernameCheck} autoCapitalize="none" />
                    {usernameAvailable === false && <Text style={{ color: '#f85149', fontSize: 12, marginBottom: 10 }}>Этот логин уже занят</Text>}
                    <TouchableOpacity disabled={!usernameAvailable} onPress={() => setRegStep(2)} style={[styles.submitBtn, { backgroundColor: usernameAvailable ? colors.accent : colors.subtext }]}>
                      <Text style={{ color: '#fff', fontWeight: '800' }}>Далее</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {regStep === 2 && (
                  <View>
                    <TextInput style={[styles.input, { borderColor: colors.border, color: colors.text }]} placeholder="Электронная почта" keyboardType="email-address" placeholderTextColor={colors.subtext} value={authForm.email} onChangeText={v => setAuthForm({...authForm, email: v})} autoCapitalize="none" />
                    <TouchableOpacity onPress={() => setRegStep(3)} style={[styles.submitBtn, { backgroundColor: colors.accent }]}>
                      <Text style={{ color: '#fff', fontWeight: '800' }}>Далее</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {regStep === 3 && (
                  <View>
                    <View style={{ position: 'relative' }}>
                      <TextInput style={[styles.input, { borderColor: colors.border, color: colors.text }]} placeholder={t.password} placeholderTextColor={colors.subtext} secureTextEntry={!showPass} value={authForm.password} onChangeText={v => setAuthForm({...authForm, password: v})} />
                      <TouchableOpacity style={{ position: 'absolute', right: 12, top: 12 }} onPress={() => setShowPass(!showPass)}>
                        <Octicons name={showPass ? "eye-closed" : "eye"} size={16} color={colors.subtext} />
                      </TouchableOpacity>
                    </View>
                    <TextInput style={[styles.input, { borderColor: colors.border, color: colors.text }]} placeholder="Повторите пароль" placeholderTextColor={colors.subtext} secureTextEntry={!showPass} value={authForm.confirm} onChangeText={v => setAuthForm({...authForm, confirm: v})} />
                    <TouchableOpacity onPress={handleAuthSubmit} style={[styles.submitBtn, { backgroundColor: colors.success }]}>
                      {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>{t.createAccount}</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            <TouchableOpacity onPress={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setRegStep(1); }}>
              <Text style={{ color: colors.accent, textAlign: 'center', marginTop: 15 }}>{authMode === 'login' ? t.newToZ : t.alreadyHaveAccount}</Text>
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
  loginBtn: { paddingHorizontal: 12, height: 34, borderRadius: 8, borderWidth: 1, justifyContent: 'center' },
  loginBtnText: { fontWeight: '700', fontSize: 13 },
  avatarMini: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#30363d' },
  card: { padding: 16, borderBottomWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  authorImg: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#30363d' },
  profileImg: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#30363d' },
  logoutBtn: { height: 44, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalBox: { borderRadius: 12, borderWidth: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 15 },
  submitBtn: { height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  tabs: { height: 65, flexDirection: 'row', borderTopWidth: 1 },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4 },
});