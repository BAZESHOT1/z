import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Text, ActivityIndicator, useWindowDimensions, TouchableOpacity, TextInput, RefreshControl, Image } from 'react-native';
import { Home, MessageSquare, LayoutGrid, User, Send, Image as ImageIcon, Globe, Sun, Moon, LogIn } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';

import { translations } from './i18n';
import { useTheme } from './themeContext';
import { fetchCurrentUser, fetchFeedPosts, setAuthToken, createPost, getAvatarUrl } from './api';
import { APP_NAME } from './config';
import Sidebar from '../components/Sidebar';
import Dock from '../components/Dock';
import PostCard from '../components/PostCard';
import ShareSheet from '../components/ShareSheet';

export default function MainApp() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const { colors, theme, toggleTheme, lang } = useTheme();
  
  const [activeTab, setActiveTab] = useState<'feed' | 'chats' | 'apps' | 'profile'>('feed');
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Post Creation
  const [newPost, setNewPost] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [posting, setPosting] = useState(false);

  // Universal Share Sheet state
  const [shareItem, setShareItem] = useState<any | null>(null);

  const t = translations[lang];

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      setAuthToken(token);
      const data = await fetchCurrentUser();
      if (data) setUser(data);
    }
    loadFeed(1, true);
  };

  const loadFeed = async (pageNum: number = 1, isReset: boolean = false) => {
    if (pageNum > 1) setLoadingMore(true);
    else setLoading(true);

    try {
      const res = await fetchFeedPosts(pageNum, 10);
      if (res && res.posts) {
        if (isReset) {
          setPosts(res.posts);
        } else {
          setPosts((prev) => [...prev, ...res.posts]);
        }
        setHasMore(res.hasMore);
        setPage(pageNum);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadFeed(1, true);
  };

  const handleCreatePost = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (!newPost.trim()) return;
    setPosting(true);
    try {
      const created = await createPost(newPost, mediaUrl.trim() || undefined);
      if (created) {
        setPosts([created, ...posts]);
        setNewPost('');
        setMediaUrl('');
        setShowMediaInput(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPosting(false);
    }
  };

  const handleTabPress = (tab: any) => {
    if (tab === 'login') { router.push('/auth/login'); return; }
    if (tab === 'settings') { router.push('/settings'); return; }
    if ((tab === 'profile' || tab === 'chats') && !user) { 
      router.push('/auth/login'); 
      return; 
    }
    if (tab === 'profile') { router.push(`/profile/${user.username}`); return; }
    setActiveTab(tab);
  };

  const dockItems = [
    { id: 'feed', icon: <Home size={20} color={activeTab === 'feed' ? '#fff' : colors.textSecondary} />, label: t.home, onClick: () => handleTabPress('feed') },
    { id: 'chats', icon: <MessageSquare size={20} color={activeTab === 'chats' ? '#fff' : colors.textSecondary} />, label: t.chats, onClick: () => handleTabPress('chats') },
    { id: 'apps', icon: <LayoutGrid size={20} color={activeTab === 'apps' ? '#fff' : colors.textSecondary} />, label: t.apps, onClick: () => handleTabPress('apps') },
    { id: 'profile', icon: <User size={20} color={activeTab === 'profile' ? '#fff' : colors.textSecondary} />, label: t.profile, onClick: () => handleTabPress('profile') },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.shell, isDesktop && styles.desktopShell]}>
        {isDesktop && <Sidebar activeTab={activeTab} onTabPress={handleTabPress} t={t} user={user} />}

        <View style={styles.content}>
          <ScrollView 
            style={styles.scroll} 
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          >
            <View style={[styles.page, isDesktop && styles.desktopPage]}>
              
              {/* Header */}
              <View style={[styles.feedHeader, { borderColor: colors.cardBorder }]}>
                <View style={styles.headerLeft}>
                  <View style={[styles.zBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.zBadgeText}>{APP_NAME}</Text>
                  </View>
                  <Text style={[styles.feedTitle, { color: colors.text }]}>{t.home}</Text>
                </View>

                <View style={styles.headerRight}>
                  {!isDesktop && (
                    <TouchableOpacity style={[styles.iconPill, { backgroundColor: colors.cardBg }]} onPress={toggleTheme}>
                      {theme === 'dark' ? <Sun size={18} color="#fbbf24" /> : <Moon size={18} color="#6366f1" />}
                    </TouchableOpacity>
                  )}

                  {!user ? (
                    <TouchableOpacity style={[styles.loginHeaderBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/auth/login')}>
                      <LogIn size={16} color="#fff" /><Text style={styles.loginHeaderBtnText}>{t.signIn}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => router.push('/settings')} style={[styles.avatarBtn, { borderColor: colors.primary }]}>
                      <Image source={{ uri: getAvatarUrl(user.username, user.avatar) }} style={styles.miniAvatar} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Guest Banner */}
              {!user && (
                <Animated.View entering={FadeIn} style={[styles.guestCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                  <Text style={[styles.guestTitle, { color: colors.text }]}>{t.guestGreeting}</Text>
                  <Text style={[styles.guestSub, { color: colors.textSecondary }]}>{t.guestSub}</Text>
                  <View style={styles.guestActions}>
                    <TouchableOpacity style={[styles.guestBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/auth/login')}>
                      <Text style={styles.guestBtnText}>{t.signIn}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.guestBtn, styles.guestSecondaryBtn, { borderColor: colors.cardBorder }]} onPress={() => router.push('/auth/register')}>
                      <Text style={[styles.guestBtnText, { color: colors.text }]}>{t.join}</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )}

              {/* Feed Content */}
              {activeTab === 'feed' && (
                <Animated.View entering={FadeIn}>
                  {user && (
                    <View style={[styles.createCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                      <TextInput 
                        style={[styles.createInput, { color: colors.text }]} 
                        placeholder={t.whatsNew} 
                        placeholderTextColor={colors.textSecondary} 
                        multiline 
                        value={newPost}
                        onChangeText={setNewPost}
                      />

                      {showMediaInput && (
                        <TextInput
                          style={[styles.mediaInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                          placeholder={t.imageUrlPlaceholder}
                          placeholderTextColor={colors.textSecondary}
                          value={mediaUrl}
                          onChangeText={setMediaUrl}
                        />
                      )}

                      <View style={styles.createFooter}>
                        <TouchableOpacity style={styles.iconActionBtn} onPress={() => setShowMediaInput(!showMediaInput)}>
                          <ImageIcon size={20} color={showMediaInput ? colors.primary : colors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={[styles.sendBtn, { backgroundColor: colors.primary }, !newPost.trim() && styles.sendBtnDisabled]} 
                          onPress={handleCreatePost}
                          disabled={!newPost.trim() || posting}
                        >
                          {posting ? <ActivityIndicator size="small" color="#fff" /> : <Send size={18} color="#fff" />}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Posts List */}
                  {loading ? (
                    <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
                  ) : (
                    posts.map((p) => (
                      <PostCard 
                        key={p.id}
                        post={p}
                        currentUser={user}
                        t={t}
                        onShare={(item) => setShareItem(item)}
                        onPostDeleted={(id) => setPosts(posts.filter(item => item.id !== id))}
                        onPostUpdated={(updated) => setPosts(posts.map(item => item.id === updated.id ? updated : item))}
                      />
                    ))
                  )}

                  {loadingMore && (
                    <View style={styles.loadingMoreBox}>
                      <ActivityIndicator color={colors.primary} />
                      <Text style={[styles.loadingMoreText, { color: colors.textSecondary }]}>{t.loadingMore}</Text>
                    </View>
                  )}
                </Animated.View>
              )}

            </View>
          </ScrollView>

          {/* Share Sheet Menu */}
          <ShareSheet 
            visible={shareItem !== null} 
            item={shareItem} 
            onClose={() => setShareItem(null)} 
          />

          {!isDesktop && <Dock items={dockItems} activeTab={activeTab} />}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  shell: { flex: 1 },
  desktopShell: { flexDirection: 'row' },
  content: { flex: 1 },
  scroll: { flex: 1 },
  page: { padding: 16, maxWidth: 640, alignSelf: 'center', width: '100%', paddingBottom: 100 },
  desktopPage: { paddingVertical: 24 },
  feedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  zBadge: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  zBadgeText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  feedTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconPill: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  loginHeaderBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 18 },
  loginHeaderBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  avatarBtn: { borderRadius: 18, overflow: 'hidden', borderWidth: 2 },
  miniAvatar: { width: 32, height: 32 },
  guestCard: { padding: 20, borderRadius: 20, marginBottom: 20, borderWidth: 1 },
  guestTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  guestSub: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  guestActions: { flexDirection: 'row', gap: 10 },
  guestBtn: { flex: 1, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  guestSecondaryBtn: { borderWidth: 1, backgroundColor: 'transparent' },
  guestBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  createCard: { borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1 },
  createInput: { fontSize: 15, minHeight: 60, textAlignVertical: 'top' },
  mediaInput: { padding: 10, borderRadius: 8, marginTop: 10, borderWidth: 1, fontSize: 13 },
  createFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  iconActionBtn: { padding: 8 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  loadingMoreBox: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, paddingVertical: 16 },
  loadingMoreText: { fontSize: 13, fontWeight: '600' }
});