import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Text, Image, ActivityIndicator, useWindowDimensions, TouchableOpacity, TextInput } from 'react-native';
import { Home, MessageSquare, LayoutGrid, User, Settings, Globe, Send, Heart, Repeat } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import Animated, { FadeIn, SlideInUp } from 'react-native-reanimated';

import { translations, Language } from './i18n';
import { fetchCurrentUser, fetchPosts, setAuthToken, createPost } from './api';
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
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);

  const t = translations[lang];

  useEffect(() => {
    const init = async () => {
      const token = await AsyncStorage.getItem('auth_token');
      const savedLang = await AsyncStorage.getItem('lang') as Language;
      if (savedLang) setLang(savedLang);
      if (token) {
        setAuthToken(token);
        const data = await fetchCurrentUser();
        if (data) setUser(data);
      }
      loadContent();
    };
    init();
  }, []);

  const loadContent = async () => {
    try {
      const data = await fetchPosts();
      setPosts(data || []);
    } catch (e) {} finally { setLoading(false); }
  };

  const handleCreatePost = async () => {
    if (!newPost.trim() || !user) return;
    setPosting(true);
    try {
      const post = await createPost(newPost);
      setPosts([post, ...posts]);
      setNewPost('');
    } catch (e) {} finally { setPosting(false); }
  };

  const handleTabPress = (tab: any) => {
    if ((tab === 'profile' || tab === 'chats') && !user) {
      router.push('/auth/login');
      return;
    }
    if (tab === 'profile') {
      router.push(`/profile/${user.username}`);
      return;
    }
    setActiveTab(tab);
  };

  const dockItems = [
    { id: 'feed', icon: <Home size={22} color={activeTab === 'feed' ? '#fff' : '#7e8590'} />, label: t.home, onClick: () => handleTabPress('feed') },
    { id: 'chats', icon: <MessageSquare size={22} color={activeTab === 'chats' ? '#fff' : '#7e8590'} />, label: t.chats, onClick: () => handleTabPress('chats') },
    { id: 'apps', icon: <LayoutGrid size={22} color={activeTab === 'apps' ? '#fff' : '#7e8590'} />, label: t.apps, onClick: () => handleTabPress('apps') },
    { id: 'profile', icon: <User size={22} color={activeTab === 'profile' ? '#fff' : '#7e8590'} />, label: t.profile, onClick: () => handleTabPress('profile') },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.shell, isDesktop && styles.desktopShell]}>
        {isDesktop && <Sidebar activeTab={activeTab} onTabPress={handleTabPress} t={t} />}

        <View style={styles.content}>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.page}>
              <View style={styles.feedHeader}>
                <Text style={styles.feedTitle}>{activeTab === 'feed' ? t.home : t.chats}</Text>
                {user && (
                  <TouchableOpacity onPress={() => router.push('/settings')} style={styles.avatarMiniBtn}>
                    <Image source={{ uri: user.avatar || 'https://via.placeholder.com/40' }} style={styles.miniAvatar} />
                  </TouchableOpacity>
                )}
              </View>

              {activeTab === 'feed' && (
                <Animated.View entering={FadeIn}>
                  {user && (
                    <View style={styles.createCard}>
                      <TextInput 
                        style={styles.createInput} 
                        placeholder="Что нового?" 
                        placeholderTextColor="#8b949e" 
                        multiline 
                        value={newPost}
                        onChangeText={setNewPost}
                      />
                      <View style={styles.createFooter}>
                        <TouchableOpacity 
                          style={[styles.sendBtn, !newPost.trim() && styles.sendBtnDisabled]} 
                          onPress={handleCreatePost}
                          disabled={!newPost.trim() || posting}
                        >
                          {posting ? <ActivityIndicator size="small" color="#fff" /> : <Send size={18} color="#fff" />}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {loading ? <ActivityIndicator color="#5353ff" style={{ marginTop: 40 }} /> : 
                    posts.map((p, idx) => (
                      <Animated.View key={p.id} entering={SlideInUp.delay(idx * 100)} style={styles.postCard}>
                        <TouchableOpacity onPress={() => router.push(`/profile/${p.author.username}`)} style={styles.postHeader}>
                          <Image source={{ uri: p.author.avatar || 'https://via.placeholder.com/40' }} style={styles.postAvatar} />
                          <View>
                            <Text style={styles.postAuthor}>{p.author.firstName || p.author.username}</Text>
                            <Text style={styles.postMeta}>@{p.author.username}</Text>
                          </View>
                        </TouchableOpacity>
                        <Text style={styles.postContent}>{p.content}</Text>
                        <View style={styles.postActions}>
                          <TouchableOpacity style={styles.postAction}><Heart size={18} color="#8b949e" /><Text style={styles.actionCount}>{p._count?.likes || 0}</Text></TouchableOpacity>
                          <TouchableOpacity style={styles.postAction}><MessageSquare size={18} color="#8b949e" /></TouchableOpacity>
                          <TouchableOpacity style={styles.postAction}><Repeat size={18} color="#8b949e" /></TouchableOpacity>
                        </View>
                      </Animated.View>
                    ))
                  }
                </Animated.View>
              )}
            </View>
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
  page: { padding: 20, maxWidth: 600, alignSelf: 'center', width: '100%' },
  feedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  feedTitle: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  avatarMiniBtn: { borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: '#5353ff' },
  miniAvatar: { width: 32, height: 32 },
  createCard: { backgroundColor: '#161b22', borderRadius: 20, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#30363d' },
  createInput: { color: '#fff', fontSize: 16, minHeight: 60, textAlignVertical: 'top' },
  createFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  sendBtn: { backgroundColor: '#5353ff', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  postCard: { backgroundColor: '#161b22', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#30363d' },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  postAvatar: { width: 44, height: 44, borderRadius: 22 },
  postAuthor: { color: '#fff', fontWeight: '800', fontSize: 16 },
  postMeta: { color: '#8b949e', fontSize: 13 },
  postContent: { color: '#e6edf3', lineHeight: 24, fontSize: 15 },
  postActions: { flexDirection: 'row', gap: 24, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#30363d' },
  postAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { color: '#8b949e', fontSize: 14, fontWeight: '600' }
});