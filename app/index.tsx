import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Text, Image, ActivityIndicator, useWindowDimensions, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { Home, MessageSquare, LayoutGrid, User, Send, Heart, Repeat, Image as ImageIcon, Globe, Sun, Moon, LogIn } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import Animated, { FadeIn, SlideInUp, Layout as ReanimatedLayout } from 'react-native-reanimated';

import { translations } from './i18n';
import { useTheme } from './themeContext';
import { fetchCurrentUser, fetchFeedPosts, setAuthToken, createPost, getAvatarUrl, toggleLike, fetchComments, createComment } from './api';
import Sidebar from '../components/Sidebar';
import Dock from '../components/Dock';

export default function MainApp() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const { colors, theme, toggleTheme, lang, setLanguage } = useTheme();
  
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

  // Active expanded comment post ID
  const [openCommentsPostId, setOpenCommentsPostId] = useState<number | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<number, any[]>>({});
  const [commentInput, setCommentInput] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

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

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 300;
    
    if (isCloseToBottom && hasMore && !loadingMore && !loading) {
      loadFeed(page + 1, false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.trim() || !user) return;
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

  const handleToggleLike = async (postId: number) => {
    // Optimistic UI update
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const isLiked = !p.isLiked;
        return {
          ...p,
          isLiked,
          _count: {
            ...p._count,
            likes: p._count.likes + (isLiked ? 1 : -1)
          }
        };
      }
      return p;
    }));

    try {
      await toggleLike(postId);
    } catch (e) {
      // Revert if error
    }
  };

  const handleToggleComments = async (postId: number) => {
    if (openCommentsPostId === postId) {
      setOpenCommentsPostId(null);
      return;
    }

    setOpenCommentsPostId(postId);
    if (!commentsMap[postId]) {
      try {
        const comments = await fetchComments(postId);
        setCommentsMap(prev => ({ ...prev, [postId]: comments }));
      } catch (e) {}
    }
  };

  const handleAddComment = async (postId: number) => {
    if (!commentInput.trim()) return;
    setSubmittingComment(true);
    try {
      const newComment = await createComment(postId, commentInput.trim());
      if (newComment) {
        setCommentsMap(prev => ({
          ...prev,
          [postId]: [newComment, ...(prev[postId] || [])]
        }));
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, _count: { ...p._count, comments: p._count.comments + 1 } } : p));
        setCommentInput('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleTabPress = (tab: any) => {
    if (tab === 'login') {
      router.push('/auth/login');
      return;
    }
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

  // Helper function to render text with clickable @mentions
  const renderFormattedText = (text: string) => {
    const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const username = part.slice(1);
        return (
          <Text
            key={index}
            style={[styles.mention, { color: colors.primary }]}
            onPress={() => router.push(`/profile/${username}`)}
          >
            {part}
          </Text>
        );
      }
      return <Text key={index} style={{ color: colors.text }}>{part}</Text>;
    });
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
            onScroll={handleScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
            }
          >
            <View style={styles.page}>
              
              {/* Header with Z Logo */}
              <View style={[styles.feedHeader, { borderColor: colors.cardBorder }]}>
                <View style={styles.headerLeft}>
                  <View style={[styles.zBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.zBadgeText}>Z</Text>
                  </View>
                  <Text style={[styles.feedTitle, { color: colors.text }]}>{activeTab === 'feed' ? t.home : t.chats}</Text>
                </View>

                {/* Right Header Actions */}
                <View style={styles.headerRight}>
                  {!isDesktop && (
                    <TouchableOpacity style={[styles.iconPill, { backgroundColor: colors.cardBg }]} onPress={toggleTheme}>
                      {theme === 'dark' ? <Sun size={18} color="#fbbf24" /> : <Moon size={18} color="#6366f1" />}
                    </TouchableOpacity>
                  )}

                  {!user ? (
                    <TouchableOpacity 
                      style={[styles.loginHeaderBtn, { backgroundColor: colors.primary }]} 
                      onPress={() => router.push('/auth/login')}
                    >
                      <LogIn size={16} color="#fff" />
                      <Text style={styles.loginHeaderBtnText}>{t.signIn}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => router.push('/settings')} style={[styles.avatarBtn, { borderColor: colors.primary }]}>
                      <Image source={{ uri: getAvatarUrl(user.username, user.avatar) }} style={styles.miniAvatar} />
                    </TouchableOpacity>
                  )}

                  {!isDesktop && !user && (
                    <TouchableOpacity 
                      style={[styles.iconPill, { backgroundColor: colors.cardBg }]}
                      onPress={() => setLanguage(lang === 'ru' ? 'en' : 'ru')}
                    >
                      <Globe size={18} color={colors.textSecondary} />
                      <Text style={[styles.langText, { color: colors.textSecondary }]}>{lang.toUpperCase()}</Text>
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
                  {/* Create Post Input */}
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
                        <TouchableOpacity 
                          style={styles.iconActionBtn} 
                          onPress={() => setShowMediaInput(!showMediaInput)}
                        >
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

                  {/* Posts Stream */}
                  {loading ? (
                    <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
                  ) : (
                    posts.map((p, idx) => (
                      <Animated.View 
                        key={p.id} 
                        entering={SlideInUp.delay(idx * 60)} 
                        layout={ReanimatedLayout}
                        style={[styles.postCard, { backgroundColor: colors.postCardBg, borderColor: colors.cardBorder }]}
                      >
                        {/* Author Header */}
                        <TouchableOpacity onPress={() => router.push(`/profile/${p.author.username}`)} style={styles.postHeader}>
                          <Image source={{ uri: getAvatarUrl(p.author.username, p.author.avatar) }} style={styles.postAvatar} />
                          <View>
                            <Text style={[styles.postAuthor, { color: colors.text }]}>{p.author.firstName || p.author.username}</Text>
                            <Text style={[styles.postMeta, { color: colors.textSecondary }]}>@{p.author.username}</Text>
                          </View>
                        </TouchableOpacity>

                        {/* Content */}
                        <Text style={[styles.postContent, { color: colors.text }]}>
                          {renderFormattedText(p.content)}
                        </Text>

                        {p.mediaUrl && (
                          <Image source={{ uri: p.mediaUrl }} style={styles.postMediaImage} resizeMode="cover" />
                        )}

                        {/* Actions Row */}
                        <View style={[styles.postActions, { borderTopColor: colors.subtleBorder }]}>
                          <TouchableOpacity style={styles.postAction} onPress={() => handleToggleLike(p.id)}>
                            <Heart size={18} color={p.isLiked ? '#ef4444' : colors.textSecondary} fill={p.isLiked ? '#ef4444' : 'transparent'} />
                            <Text style={[styles.actionCount, { color: p.isLiked ? '#ef4444' : colors.textSecondary }]}>{p._count?.likes || 0}</Text>
                          </TouchableOpacity>

                          <TouchableOpacity style={styles.postAction} onPress={() => handleToggleComments(p.id)}>
                            <MessageSquare size={18} color={openCommentsPostId === p.id ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.actionCount, { color: openCommentsPostId === p.id ? colors.primary : colors.textSecondary }]}>{p._count?.comments || 0}</Text>
                          </TouchableOpacity>

                          <TouchableOpacity style={styles.postAction}>
                            <Repeat size={18} color={colors.textSecondary} />
                          </TouchableOpacity>
                        </View>

                        {/* Expandable Comments Section */}
                        {openCommentsPostId === p.id && (
                          <View style={[styles.commentsSection, { backgroundColor: colors.commentBg, borderColor: colors.cardBorder }]}>
                            {user && (
                              <View style={styles.commentInputRow}>
                                <TextInput
                                  style={[styles.commentInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                                  placeholder={t.writeComment}
                                  placeholderTextColor={colors.textSecondary}
                                  value={commentInput}
                                  onChangeText={setCommentInput}
                                />
                                <TouchableOpacity 
                                  style={[styles.commentSendBtn, { backgroundColor: colors.primary }]}
                                  onPress={() => handleAddComment(p.id)}
                                  disabled={submittingComment}
                                >
                                  {submittingComment ? <ActivityIndicator size="small" color="#fff" /> : <Send size={14} color="#fff" />}
                                </TouchableOpacity>
                              </View>
                            )}

                            {/* Comments List */}
                            {(!commentsMap[p.id] || commentsMap[p.id].length === 0) ? (
                              <Text style={[styles.noCommentsText, { color: colors.textSecondary }]}>{t.noComments}</Text>
                            ) : (
                              commentsMap[p.id].map((c) => (
                                <View key={c.id} style={styles.commentItem}>
                                  <TouchableOpacity onPress={() => router.push(`/profile/${c.author.username}`)}>
                                    <Image source={{ uri: getAvatarUrl(c.author.username, c.author.avatar) }} style={styles.commentAvatar} />
                                  </TouchableOpacity>
                                  <View style={styles.commentContentArea}>
                                    <View style={styles.commentHeader}>
                                      <Text style={[styles.commentAuthor, { color: colors.text }]}>{c.author.firstName || c.author.username}</Text>
                                      <Text style={[styles.commentUsername, { color: colors.textSecondary }]}>@{c.author.username}</Text>
                                    </View>
                                    <Text style={[styles.commentText, { color: colors.text }]}>{renderFormattedText(c.content)}</Text>
                                  </View>
                                </View>
                              ))
                            )}
                          </View>
                        )}
                      </Animated.View>
                    ))
                  }

                  {loadingMore && (
                    <View style={styles.loadingMoreBox}>
                      <ActivityIndicator color={colors.primary} />
                      <Text style={[styles.loadingMoreText, { color: colors.textSecondary }]}>{t.loadingMore}</Text>
                    </View>
                  )}

                  {!hasMore && posts.length > 0 && (
                    <Text style={[styles.endFeedText, { color: colors.textSecondary }]}>{t.endOfFeed}</Text>
                  )}
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
  container: { flex: 1 },
  shell: { flex: 1 },
  desktopShell: { flexDirection: 'row' },
  content: { flex: 1 },
  scroll: { flex: 1 },
  page: { padding: 16, maxWidth: 640, alignSelf: 'center', width: '100%', paddingBottom: 100 },
  feedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  zBadge: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  zBadgeText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  feedTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconPill: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 4, paddingHorizontal: 8 },
  langText: { fontSize: 11, fontWeight: '800' },
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
  postCard: { borderRadius: 22, padding: 18, marginBottom: 16, borderWidth: 1 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  postAvatar: { width: 42, height: 42, borderRadius: 21 },
  postAuthor: { fontWeight: '800', fontSize: 15 },
  postMeta: { fontSize: 12 },
  postContent: { lineHeight: 22, fontSize: 15 },
  mention: { fontWeight: '700' },
  postMediaImage: { width: '100%', height: 240, borderRadius: 14, marginTop: 14 },
  postActions: { flexDirection: 'row', gap: 28, marginTop: 16, paddingTop: 14, borderTopWidth: 1 },
  postAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { fontSize: 13, fontWeight: '700' },
  commentsSection: { marginTop: 16, padding: 14, borderRadius: 16, borderWidth: 1, gap: 12 },
  commentInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  commentInput: { flex: 1, height: 38, borderRadius: 19, paddingHorizontal: 14, borderWidth: 1, fontSize: 13 },
  commentSendBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  noCommentsText: { textAlign: 'center', fontSize: 13, marginVertical: 8 },
  commentItem: { flexDirection: 'row', gap: 10, marginTop: 6 },
  commentAvatar: { width: 30, height: 30, borderRadius: 15 },
  commentContentArea: { flex: 1 },
  commentHeader: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  commentAuthor: { fontWeight: '700', fontSize: 13 },
  commentUsername: { fontSize: 11 },
  commentText: { fontSize: 13, marginTop: 2 },
  loadingMoreBox: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, paddingVertical: 16 },
  loadingMoreText: { fontSize: 13, fontWeight: '600' },
  endFeedText: { textAlign: 'center', fontSize: 13, marginVertical: 20 }
});