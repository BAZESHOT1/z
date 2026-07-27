import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Text, Image, ActivityIndicator, useWindowDimensions, TouchableOpacity } from 'react-native';
import { Home, MessageSquare, LayoutGrid, User, Settings, Globe } from 'lucide-react-native';
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
    const savedLang = await AsyncStorage.getItem('lang') as Language;
    if (savedLang) setLang(savedLang);

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
    // Проверка авторизации для профиля и чатов
    if (tab === 'profile' || tab === 'chats') {
      if (!user) {
        router.push('/auth/login');
        return;
      }
      
      if (tab === 'profile') {
        router.push(`/profile/${user.username}`);
        return;
      }
    }
    setActiveTab(tab);
  };

  const toggleLang = async () => {
    const next = lang === 'ru' ? 'en' : 'ru';
    setLang(next);
    await AsyncStorage.setItem('lang', next);
  };

  const dockItems = [
    { id: 'feed', icon: <Home size={20} color={activeTab === 'feed' ? '#fff' : '#7e8590'} />, label: t.home, onClick: () => handleTabPress('feed') },
    { id: 'chats', icon: <MessageSquare size={20} color={activeTab === 'chats' ? '#fff' : '#7e8590'} />, label: t.chats, onClick: () => handleTabPress('chats') },
    { id: 'apps', icon: <LayoutGrid size={20} color={activeTab === 'apps' ? '#fff' : '#7e8590'} />, label: t.apps, onClick: () => handleTabPress('apps') },
    { id: 'profile', icon: <User size={20} color={activeTab === 'profile' ? '#fff' : '#7e8590'} />, label: t.profile, onClick: () => handleTabPress('profile') },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {!user && (
        <TouchableOpacity style={styles.langFloat} onPress={toggleLang}>
          <Globe size={18} color="#fff" />
          <Text style={styles.langFloatText}>{lang.toUpperCase()}</Text>
        </TouchableOpacity>
      )}

      <View style={[styles.shell, isDesktop && styles.desktopShell]}>
        {isDesktop && <Sidebar activeTab={activeTab} onTabPress={handleTabPress} t={t} />}

        <View style={styles.content}>
          <ScrollView style={styles.scroll}>
            {activeTab === 'feed' && (
              <Animated.View entering={FadeIn} style={styles.page}>
                <View style={styles.feedHeader}>
                  <Text style={styles.feedTitle}>{t.home}</Text>
                  {user && (
                    <TouchableOpacity onPress={() => router.push('/settings')}>
                      <Settings color="#8b949e" size={20} />
                    </TouchableOpacity>
                  )}
                </View>
                {loading ? <ActivityIndicator color="#5353ff" /> : 
                  posts.map(p => (
                    <TouchableOpacity key={p.id} style={styles.postCard} onPress={() => router.push(`/profile/${p.author.username}`)}>
                      <View style={styles.postHeader}>
                        <Image source={{ uri: p.author.avatar }} style={styles.postAvatar} />
                        <View><Text style={styles.postAuthor}>{p.author.name}</Text><Text style={styles.postMeta}>@{p.author.username}</Text></View>
                      </View>
                      <Text style={styles.postContent}>{p.content}</Text>
                    </TouchableOpacity>
                  ))
                }
              </Animated.View>
            )}
            
            {activeTab === 'chats' && (
              <View style={styles.page}>
                 <Text style={styles.feedTitle}>{t.chats}</Text>
                 <Text style={{color: '#8b949e', marginTop: 20}}>У вас пока нет активных диалогов.</Text>
              </View>
            )}
          </ScrollView>
          {!isDesktop && <Dock items={dockItems} activeTab={activeTab} />}
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
  feedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  feedTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  postCard: { backgroundColor: '#161b22', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#30363d' },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  postAvatar: { width: 40, height: 40, borderRadius: 20 },
  postAuthor: { color: '#fff', fontWeight: '700' },
  postMeta: { color: '#8b949e', fontSize: 12 },
  postContent: { color: '#c9d1d9', lineHeight: 20 },
  langFloat: { position: 'absolute', top: 50, right: 20, zIndex: 100, backgroundColor: '#21262d', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#30363d' },
  langFloatText: { color: '#fff', fontWeight: '700', fontSize: 12 }
});