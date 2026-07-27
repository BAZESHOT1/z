import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, useWindowDimensions, ScrollView, Image, ActivityIndicator } from 'react-native';
import { Octicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import { translations, Language } from './i18n';
import { fetchCurrentUser, fetchPosts, setAuthToken } from './api';

export default function MainApp() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const [lang, setLang] = useState<Language>('ru');
  const [activeTab, setActiveTab] = useState<'feed' | 'chats' | 'apps' | 'profile'>('feed');
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const t = translations[lang];

  useEffect(() => {
    loadSettings();
    checkAuth();
    loadContent();
  }, []);

  const loadSettings = async () => {
    const savedLang = await AsyncStorage.getItem('user_lang');
    if (savedLang) setLang(savedLang as Language);
  };

  const checkAuth = async () => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      setAuthToken(token);
      try {
        const data = await fetchCurrentUser();
        if (data) setUser(data);
        else {
          await AsyncStorage.removeItem('auth_token');
          setAuthToken(null);
        }
      } catch (e) {
        setAuthToken(null);
      }
    }
  };

  const loadContent = async () => {
    setLoading(true);
    try {
      const data = await fetchPosts();
      setPosts(data);
    } catch (e) {} finally { setLoading(false); }
  };

  const handleTabPress = (tab: any) => {
    // Если вкладка требует авторизации (профиль или чаты)
    if ((tab === 'profile' || tab === 'chats') && !user) {
      router.push('/auth/login');
      return;
    }
    setActiveTab(tab);
  };

  const NavItem = ({ id, icon, label }: any) => {
    const active = activeTab === id;
    return (
      <TouchableOpacity 
        style={[styles.navItem, isDesktop && styles.desktopNavItem, active && styles.activeNavItem]} 
        onPress={() => handleTabPress(id)}
      >
        <Octicons name={icon} size={isDesktop ? 20 : 18} color={active ? '#d66853' : '#8b949e'} />
        <Text style={[styles.navText, active && styles.activeNavText, isDesktop && styles.desktopNavText]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.shell, isDesktop && styles.desktopShell]}>
        {isDesktop && (
          <View style={styles.sidebar}>
            <View style={styles.sidebarBrand}>
              <View style={styles.miniLogo}><Octicons name="terminal" size={16} color="#fff" /></View>
              <Text style={styles.brandName}>Z Platform</Text>
            </View>
            <View style={styles.sidebarNav}>
              <NavItem id="feed" icon="home" label={t.home} />
              <NavItem id="chats" icon="comment-discussion" label={t.chats} />
              <NavItem id="apps" icon="apps" label={t.apps} />
              <NavItem id="profile" icon="person" label={t.profile} />
            </View>
            <View style={styles.sidebarFooter}>
              {user ? (
                <View style={styles.userBrief}>
                  <Image source={{ uri: user.avatar }} style={styles.sidebarAvatar} />
                  <View style={styles.sidebarUserInfo}>
                    <Text style={styles.sidebarUserName}>{user.firstName}</Text>
                    <Text style={styles.sidebarUserLogin}>@{user.username}</Text>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.guestLoginBtn} onPress={() => router.push('/auth/login')}>
                  <Octicons name="sign-in" size={16} color="#d66853" />
                  <Text style={styles.guestLoginText}>{t.signIn}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.mainHeader}>
             {!isDesktop && <Text style={styles.headerTitle}>{t[activeTab]}</Text>}
             {isDesktop && <Text style={styles.headerTitle}>{t[activeTab]}</Text>}
             <View style={styles.headerRight}>
               <TouchableOpacity onPress={() => setLang(lang === 'ru' ? 'en' : 'ru')} style={styles.langSwitch}>
                 <Text style={styles.langText}>{lang.toUpperCase()}</Text>
               </TouchableOpacity>
               {!user && !isDesktop && (
                 <TouchableOpacity onPress={() => router.push('/auth/login')} style={styles.mobileLoginIcon}>
                   <Octicons name="person" size={20} color="#8b949e" />
                 </TouchableOpacity>
               )}
             </View>
          </View>

          <ScrollView style={styles.scroll}>
            {activeTab === 'feed' && (
              <Animated.View entering={FadeIn.duration(400)} style={styles.page}>
                {loading ? <ActivityIndicator style={{ marginTop: 40 }} color="#d66853" /> : 
                  posts.map(p => (
                    <View key={p.id} style={styles.postCard}>
                      <View style={styles.postHeader}>
                        <Image source={{ uri: p.author.avatar }} style={styles.postAvatar} />
                        <View>
                          <Text style={styles.postAuthor}>{p.author.name}</Text>
                          <Text style={styles.postMeta}>@{p.author.username}</Text>
                        </View>
                      </View>
                      <Text style={styles.postContent}>{p.content}</Text>
                    </View>
                  ))
                }
              </Animated.View>
            )}

            {activeTab === 'chats' && user && (
              <Animated.View entering={SlideInRight} style={styles.centerPage}>
                <Octicons name="comment-discussion" size={48} color="#30363d" />
                <Text style={styles.emptyText}>Сообщений пока нет</Text>
              </Animated.View>
            )}

            {activeTab === 'apps' && (
              <Animated.View entering={FadeIn} style={styles.page}>
                <Text style={styles.sectionTitle}>Available Extensions</Text>
                <View style={styles.appGrid}>
                   <TouchableOpacity style={styles.appItem}>
                      <View style={[styles.appIcon, { backgroundColor: '#d66853' }]}><Octicons name="server" size={24} color="#fff" /></View>
                      <Text style={styles.appLabel}>{t.cluster}</Text>
                   </TouchableOpacity>
                </View>
              </Animated.View>
            )}

            {activeTab === 'profile' && user && (
              <Animated.View entering={FadeIn} style={styles.page}>
                <View style={styles.profileHeader}>
                   <View style={styles.avatarWrapper}>
                     <Image source={{ uri: user.avatar }} style={styles.largeAvatar} />
                     <View style={styles.onlineBadge} />
                   </View>
                   <Text style={styles.profileName}>{user.firstName}</Text>
                   <Text style={styles.profileHandle}>@{user.username}</Text>
                   <View style={styles.roleTag}><Text style={styles.roleText}>{user.role.toUpperCase()}</Text></View>
                </View>
                <TouchableOpacity style={styles.logoutBtn} onPress={async () => { await AsyncStorage.removeItem('auth_token'); setUser(null); setAuthToken(null); setActiveTab('feed'); }}>
                  <Text style={styles.logoutText}>{t.signOut}</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </ScrollView>

          {/* Mobile TabBar */}
          {!isDesktop && (
            <View style={styles.bottomNav}>
              <NavItem id="feed" icon="home" label={t.home} />
              <NavItem id="chats" icon="comment-discussion" label={t.chats} />
              <NavItem id="apps" icon="apps" label={t.apps} />
              <NavItem id="profile" icon="person" label={t.profile} />
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  shell: { flex: 1, flexDirection: 'column' },
  desktopShell: { flexDirection: 'row' },
  sidebar: { width: 280, backgroundColor: '#161b22', borderRightWidth: 1, borderRightColor: '#30363d', padding: 24 },
  sidebarBrand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 40 },
  miniLogo: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#d66853', justifyContent: 'center', alignItems: 'center' },
  brandName: { color: '#c9d1d9', fontWeight: '900', fontSize: 20, letterSpacing: -0.5 },
  sidebarNav: { flex: 1 },
  sidebarFooter: { paddingTop: 20, borderTopWidth: 1, borderTopColor: '#30363d' },
  userBrief: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sidebarAvatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#30363d' },
  sidebarUserInfo: { flex: 1 },
  sidebarUserName: { color: '#c9d1d9', fontWeight: '700', fontSize: 15 },
  sidebarUserLogin: { color: '#8b949e', fontSize: 12 },
  guestLoginBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: 'rgba(214, 104, 83, 0.1)' },
  guestLoginText: { color: '#d66853', fontWeight: '700', fontSize: 14 },
  content: { flex: 1, backgroundColor: '#0d1117' },
  mainHeader: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#30363d', backgroundColor: '#0d1117' },
  headerTitle: { color: '#c9d1d9', fontSize: 20, fontWeight: '800' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  langSwitch: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#30363d' },
  langText: { color: '#8b949e', fontSize: 11, fontWeight: '800' },
  mobileLoginIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#161b22', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#30363d' },
  scroll: { flex: 1 },
  page: { padding: 20 },
  centerPage: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { color: '#484f58', marginTop: 16, fontSize: 15 },
  postCard: { backgroundColor: '#161b22', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#30363d' },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  postAvatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#30363d' },
  postAuthor: { color: '#c9d1d9', fontWeight: '700', fontSize: 16 },
  postMeta: { color: '#8b949e', fontSize: 13 },
  postContent: { color: '#c9d1d9', lineHeight: 24, fontSize: 15 },
  appGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginTop: 24 },
  appItem: { alignItems: 'center', gap: 10, width: 80 },
  appIcon: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10 },
  appLabel: { color: '#c9d1d9', fontSize: 13, fontWeight: '600' },
  sectionTitle: { color: '#8b949e', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5 },
  profileHeader: { alignItems: 'center', paddingVertical: 32 },
  avatarWrapper: { position: 'relative', marginBottom: 20 },
  largeAvatar: { width: 110, height: 110, borderRadius: 36, borderWidth: 3, borderColor: '#d66853' },
  onlineBadge: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#238636', borderWidth: 4, borderColor: '#0d1117' },
  profileName: { color: '#c9d1d9', fontSize: 26, fontWeight: '900' },
  profileHandle: { color: '#8b949e', fontSize: 17, marginBottom: 16 },
  roleTag: { backgroundColor: '#21262d', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#30363d' },
  roleText: { color: '#d66853', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  logoutBtn: { marginTop: 40, height: 52, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(214, 104, 83, 0.4)', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(214, 104, 83, 0.05)' },
  logoutText: { color: '#d66853', fontWeight: '800', fontSize: 15 },
  bottomNav: { height: 75, flexDirection: 'row', backgroundColor: '#161b22', borderTopWidth: 1, borderTopColor: '#30363d', paddingBottom: 15 },
  navItem: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4 },
  desktopNavItem: { flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, marginBottom: 8 },
  activeNavItem: { backgroundColor: 'rgba(214, 104, 83, 0.12)' },
  navText: { fontSize: 11, color: '#8b949e', fontWeight: '700' },
  desktopNavText: { fontSize: 16, marginLeft: 14 },
  activeNavText: { color: '#d66853' }
});