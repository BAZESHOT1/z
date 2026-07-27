import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Text, Image, ActivityIndicator, useWindowDimensions, TouchableOpacity } from 'react-native';
import { Home, MessageSquare, LayoutGrid, User, LogOut } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';

import { translations, Language } from './i18n';
import { fetchCurrentUser, fetchPosts, setAuthToken } from './api';
import Sidebar from '../components/Sidebar';
import Dock from '../components/Dock';

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
    if (token) {
      setAuthToken(token);
      const data = await fetchCurrentUser();
      if (data) setUser(data);
    }
  };

  const loadContent = async () => {
    try {
      const data = await fetchPosts();
      setPosts(data);
    } catch (e) {} finally { setLoading(false); }
  };

  const handleTabPress = (tab: any) => {
    if ((tab === 'profile' || tab === 'chats') && !user) {
      router.push('/auth/login');
      return;
    }
    setActiveTab(tab);
  };

  const dockItems = [
    { id: 'feed', icon: <Home size={20} color={activeTab === 'feed' ? '#fff' : '#7e8590'} />, label: t.home, onClick: () => handleTabPress('feed') },
    { id: 'chats', icon: <MessageSquare size={20} color={activeTab === 'chats' ? '#fff' : '#7e8590'} />, label: t.chats, onClick: () => handleTabPress('chats') },
    { id: 'apps', icon: <LayoutGrid size={20} color={activeTab === 'apps' ? '#fff' : '#7e8590'} />, label: t.apps, onClick: () => handleTabPress('apps') },
    { id: 'profile', icon: <User size={20} color={activeTab === 'profile' ? '#fff' : '#7e8590'} />, label: t.profile, onClick: () => handleTabPress('profile') },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.shell, isDesktop && styles.desktopShell]}>
        {isDesktop && (
          <Sidebar activeTab={activeTab} onTabPress={handleTabPress} t={t} />
        )}

        <View style={styles.content}>
          <ScrollView style={styles.scroll} contentContainerStyle={!isDesktop ? { paddingBottom: 100 } : undefined}>
            {activeTab === 'feed' && (
              <Animated.View entering={FadeIn} style={styles.page}>
                {loading ? <ActivityIndicator color="#5353ff" style={{ marginTop: 40 }} /> : 
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
                <MessageSquare size={48} color="#30363d" />
                <Text style={styles.emptyText}>У вас пока нет активных диалогов</Text>
              </View>
            )}

            {activeTab === 'apps' && (
              <View style={styles.page}>
                <Text style={styles.sectionTitle}>Доступные приложения</Text>
                <View style={styles.appGrid}>
                   <View style={styles.appItem}>
                      <View style={styles.appIcon}><LayoutGrid size={24} color="#fff" /></View>
                      <Text style={styles.appLabel}>{t.cluster}</Text>
                   </View>
                </View>
              </View>
            )}

            {activeTab === 'profile' && user && (
              <View style={styles.page}>
                <View style={styles.profileBox}>
                  <Image source={{ uri: user.avatar }} style={styles.largeAvatar} />
                  <Text style={styles.profileName}>{user.firstName}</Text>
                  <Text style={styles.profileHandle}>@{user.username}</Text>
                  <TouchableOpacity 
                    style={styles.logoutBtn} 
                    onPress={async () => { 
                      await AsyncStorage.removeItem('auth_token'); 
                      setUser(null); 
                      router.replace('/auth/login'); 
                    }}
                  >
                    <LogOut size={18} color="#f85149" style={{ marginRight: 8 }} />
                    <Text style={styles.logoutText}>{t.signOut}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          {!isDesktop && (
            <Dock items={dockItems} activeTab={activeTab} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  shell: { flex: 1 },
  desktopShell: { flexDirection: 'row' },
  content: { flex: 1 },
  scroll: { flex: 1 },
  page: { padding: 20 },
  centerPage: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { color: '#8b949e', marginTop: 16, fontSize: 15 },
  postCard: { backgroundColor: '#161b22', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#30363d' },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  postAvatar: { width: 44, height: 44, borderRadius: 22 },
  postAuthor: { color: '#c9d1d9', fontWeight: '700', fontSize: 16 },
  postMeta: { color: '#8b949e', fontSize: 13 },
  postContent: { color: '#c9d1d9', lineHeight: 24 },
  sectionTitle: { color: '#8b949e', fontSize: 14, fontWeight: '800', textTransform: 'uppercase', marginBottom: 20 },
  appGrid: { flexDirection: 'row', gap: 20 },
  appItem: { alignItems: 'center', gap: 10 },
  appIcon: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#5353ff', justifyContent: 'center', alignItems: 'center' },
  appLabel: { color: '#c9d1d9', fontSize: 12, fontWeight: '600' },
  profileBox: { alignItems: 'center', paddingVertical: 40 },
  largeAvatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 20, borderWidth: 3, borderColor: '#5353ff' },
  profileName: { color: '#c9d1d9', fontSize: 26, fontWeight: '900' },
  profileHandle: { color: '#8b949e', fontSize: 16, marginBottom: 30 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#f85149' },
  logoutText: { color: '#f85149', fontWeight: '700' }
});