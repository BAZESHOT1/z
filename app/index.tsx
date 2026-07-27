import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, useWindowDimensions, ScrollView, Image, ActivityIndicator } from 'react-native';
import { Octicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeIn } from 'react-native-reanimated';
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
    checkAuth();
    loadContent();
  }, []);

  const checkAuth = async () => {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    setAuthToken(token);
    const data = await fetchCurrentUser();
    if (data) setUser(data);
    else router.replace('/auth/login');
  };

  const loadContent = async () => {
    try {
      const data = await fetchPosts();
      setPosts(data);
    } catch (e) {} finally { setLoading(false); }
  };

  const NavItem = ({ id, icon, label }: any) => {
    const active = activeTab === id;
    return (
      <TouchableOpacity 
        style={[styles.navItem, isDesktop && styles.desktopNavItem, active && styles.activeNavItem]} 
        onPress={() => setActiveTab(id)}
      >
        <Octicons name={icon} size={isDesktop ? 20 : 18} color={active ? '#d66853' : '#8b949e'} />
        <Text style={[styles.navText, active && styles.activeNavText, isDesktop && styles.desktopNavText]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const Sidebar = () => (
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
      {user && (
        <View style={styles.sidebarFooter}>
          <Image source={{ uri: user.avatar }} style={styles.sidebarAvatar} />
          <View style={styles.sidebarUserInfo}>
            <Text style={styles.sidebarUserName}>{user.firstName}</Text>
            <Text style={styles.sidebarUserLogin}>@{user.username}</Text>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.shell, isDesktop && styles.desktopShell]}>
        {isDesktop && <Sidebar />}

        <View style={styles.content}>
          {/* Mobile Header */}
          {!isDesktop && (
            <View style={styles.mobileHeader}>
               <Text style={styles.headerTitle}>{t[activeTab]}</Text>
               <TouchableOpacity onPress={() => setLang(lang === 'ru' ? 'en' : 'ru')} style={styles.langSwitch}>
                 <Text style={styles.langText}>{lang.toUpperCase()}</Text>
               </TouchableOpacity>
            </View>
          )}

          <ScrollView style={styles.scroll}>
            {activeTab === 'feed' && (
              <Animated.View entering={FadeIn} style={styles.page}>
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

            {activeTab === 'chats' && (
              <View style={styles.centerPage}>
                <Octicons name="comment-discussion" size={48} color="#30363d" />
                <Text style={styles.emptyText}>Сообщений пока нет</Text>
              </View>
            )}

            {activeTab === 'apps' && (
              <View style={styles.page}>
                <Text style={styles.sectionTitle}>System Applications</Text>
                <View style={styles.appGrid}>
                   <TouchableOpacity style={styles.appItem} onPress={() => {}}>
                      <View style={[styles.appIcon, { backgroundColor: '#d66853' }]}><Octicons name="server" size={24} color="#fff" /></View>
                      <Text style={styles.appLabel}>{t.cluster}</Text>
                   </TouchableOpacity>
                </View>
              </View>
            )}

            {activeTab === 'profile' && user && (
              <View style={styles.page}>
                <View style={styles.profileHeader}>
                   <Image source={{ uri: user.avatar }} style={styles.largeAvatar} />
                   <Text style={styles.profileName}>{user.firstName}</Text>
                   <Text style={styles.profileHandle}>@{user.username}</Text>
                   <View style={styles.roleTag}><Text style={styles.roleText}>{user.role.toUpperCase()}</Text></View>
                </View>
                <TouchableOpacity style={styles.logoutBtn} onPress={async () => { await AsyncStorage.removeItem('auth_token'); router.replace('/auth/login'); }}>
                  <Text style={styles.logoutText}>{t.signOut}</Text>
                </TouchableOpacity>
              </View>
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
  sidebar: { width: 260, backgroundColor: '#161b22', borderRightWidth: 1, borderRightColor: '#30363d', padding: 20 },
  sidebarBrand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 32 },
  miniLogo: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#d66853', justifyContent: 'center', alignItems: 'center' },
  brandName: { color: '#c9d1d9', fontWeight: '800', fontSize: 18 },
  sidebarNav: { flex: 1 },
  sidebarFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#30363d' },
  sidebarAvatar: { width: 40, height: 40, borderRadius: 20 },
  sidebarUserInfo: { flex: 1 },
  sidebarUserName: { color: '#c9d1d9', fontWeight: '700', fontSize: 14 },
  sidebarUserLogin: { color: '#8b949e', fontSize: 12 },
  content: { flex: 1, backgroundColor: '#0d1117' },
  mobileHeader: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#30363d' },
  headerTitle: { color: '#c9d1d9', fontSize: 18, fontWeight: '800' },
  langSwitch: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#30363d' },
  langText: { color: '#8b949e', fontSize: 10, fontWeight: '800' },
  scroll: { flex: 1 },
  page: { padding: 20 },
  centerPage: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { color: '#484f58', marginTop: 12, fontSize: 14 },
  postCard: { backgroundColor: '#161b22', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#30363d' },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  postAvatar: { width: 36, height: 36, borderRadius: 18 },
  postAuthor: { color: '#c9d1d9', fontWeight: '700' },
  postMeta: { color: '#8b949e', fontSize: 12 },
  postContent: { color: '#c9d1d9', lineHeight: 22 },
  appGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16 },
  appItem: { alignItems: 'center', gap: 8 },
  appIcon: { width: 60, height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  appLabel: { color: '#c9d1d9', fontSize: 12, fontWeight: '600' },
  sectionTitle: { color: '#8b949e', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  profileHeader: { alignItems: 'center', paddingVertical: 20 },
  largeAvatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 16, borderWidth: 2, borderColor: '#d66853' },
  profileName: { color: '#c9d1d9', fontSize: 24, fontWeight: '800' },
  profileHandle: { color: '#8b949e', fontSize: 16, marginBottom: 12 },
  roleTag: { backgroundColor: '#30363d', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  roleText: { color: '#c9d1d9', fontSize: 10, fontWeight: '800' },
  logoutBtn: { marginTop: 40, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#d66853', justifyContent: 'center', alignItems: 'center' },
  logoutText: { color: '#d66853', fontWeight: '700' },
  bottomNav: { height: 70, flexDirection: 'row', backgroundColor: '#161b22', borderTopWidth: 1, borderTopColor: '#30363d', paddingBottom: 10 },
  navItem: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4 },
  desktopNavItem: { flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, marginBottom: 4 },
  activeNavItem: { backgroundColor: 'rgba(214, 104, 83, 0.1)' },
  navText: { fontSize: 10, color: '#8b949e', fontWeight: '600' },
  desktopNavText: { fontSize: 14, marginLeft: 12 },
  activeNavText: { color: '#d66853' }
});