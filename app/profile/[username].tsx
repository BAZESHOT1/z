import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, ScrollView, Text, TouchableOpacity, ActivityIndicator, SafeAreaView, TextInput, useWindowDimensions, Modal } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, UserPlus, UserMinus, MessageCircle, Settings, Edit3, Save, X, Home, MessageSquare, LayoutGrid, User as UserIcon, AlertCircle, Lock, Shield } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchUserProfile, fetchCurrentUser, updateProfile, fetchPosts, toggleFollow, setAuthToken, getAvatarUrl, fetchFollowers, fetchFollowing } from '../api';
import { translations } from '../i18n';
import { useTheme } from '../themeContext';
import Animated, { FadeIn } from 'react-native-reanimated';
import Sidebar from '../../components/Sidebar';
import Dock from '../../components/Dock';
import PostCard from '../../components/PostCard';
import ShareSheet from '../../components/ShareSheet';

export default function ProfileScreen() {
  const { username } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const { colors, lang } = useTheme();

  const [user, setUser] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);

  // Modals & Lists
  const [listModalType, setListModalType] = useState<'followers' | 'following' | null>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [shareItem, setShareItem] = useState<any | null>(null);
  
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', bio: '', socialLinks: '', birthDate: '', avatar: '' });

  const isOwnProfile = currentUser?.username === username;
  const t = translations[lang];

  useEffect(() => { loadData(); }, [username]);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) setAuthToken(token);

      const [profileData, currentData] = await Promise.all([
        fetchUserProfile(username as string),
        fetchCurrentUser()
      ]);

      setUser(profileData);
      setCurrentUser(currentData);

      if (profileData && !profileData.isRestricted) {
        const postsData = await fetchPosts(username as string);
        setPosts(postsData || []);

        setEditForm({
          firstName: profileData.firstName || '',
          lastName: profileData.lastName || '',
          bio: profileData.bio || '',
          socialLinks: profileData.socialLinks || '',
          birthDate: profileData.birthDate || '',
          avatar: profileData.avatar || ''
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUser) { router.push('/auth/login'); return; }
    setFollowingLoading(true);
    try {
      const res = await toggleFollow(user.username);
      setUser({ 
        ...user, 
        isFollowing: res.following, 
        _count: { 
          ...user._count, 
          followers: user._count.followers + (res.following ? 1 : -1) 
        } 
      });
    } catch (e) {} finally { setFollowingLoading(false); }
  };

  const openUsersListModal = async (type: 'followers' | 'following') => {
    setListModalType(type);
    setListLoading(true);
    try {
      const res = type === 'followers' 
        ? await fetchFollowers(user.username) 
        : await fetchFollowing(user.username);
      setUsersList(res || []);
    } catch (e) {
      setUsersList([]);
    } finally {
      setListLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProfile(editForm);
      setEditing(false);
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const dockItems = [
    { id: 'feed', icon: <Home size={20} color={colors.textSecondary} />, label: t.home, onClick: () => router.push('/') },
    { id: 'chats', icon: <MessageSquare size={20} color={colors.textSecondary} />, label: t.chats, onClick: () => router.push('/') },
    { id: 'apps', icon: <LayoutGrid size={20} color={colors.textSecondary} />, label: t.apps, onClick: () => router.push('/') },
    { id: 'profile', icon: <UserIcon size={20} color={isOwnProfile ? "#fff" : colors.textSecondary} />, label: t.profile, onClick: () => router.push(currentUser ? `/profile/${currentUser.username}` : '/auth/login') },
  ];

  if (loading && !user) return <View style={[styles.center, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.primary} size="large" /></View>;
  
  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.notFoundBox}>
          <AlertCircle size={48} color={colors.textSecondary} />
          <Text style={[styles.notFoundTitle, { color: colors.text }]}>Пользователь не найден</Text>
          <Text style={[styles.notFoundSub, { color: colors.textSecondary }]}>Пользователь @{username} не существует или был удален</Text>
          <TouchableOpacity style={[styles.backHomeBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/')}>
            <Text style={styles.backHomeBtnText}>Вернуться на главную</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.shell, isDesktop && styles.desktopShell]}>
        {isDesktop && (
          <Sidebar 
            activeTab={isOwnProfile ? "profile" : "other"} 
            onTabPress={(tab) => {
              if (tab === 'profile') {
                if (currentUser) router.push(`/profile/${currentUser.username}`);
                else router.push('/auth/login');
              } else {
                router.push('/');
              }
            }} 
            t={t}
            user={currentUser}
          />
        )}

        <View style={styles.content}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {/* Top Bar */}
            <View style={[styles.header, { borderColor: colors.cardBorder }]}>
              <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                <ArrowLeft color={colors.text} size={22} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: colors.text }]}>@{user.username}</Text>
              {isOwnProfile ? (
                <TouchableOpacity onPress={() => router.push('/settings')} style={styles.iconBtn}>
                  <Settings color={colors.text} size={22} />
                </TouchableOpacity>
              ) : <View style={{ width: 40 }} />}
            </View>

            {/* Profile Card */}
            <Animated.View entering={FadeIn} style={[styles.profileCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.avatarWrapper}>
                <Image source={{ uri: getAvatarUrl(user.username, editForm.avatar || user.avatar) }} style={[styles.avatar, { borderColor: colors.primary }]} />
              </View>
              
              {editing ? (
                <View style={styles.editForm}>
                  <TextInput 
                    style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} 
                    placeholder="Avatar URL (https://...)" 
                    placeholderTextColor={colors.textSecondary} 
                    value={editForm.avatar} 
                    onChangeText={v => setEditForm({...editForm, avatar: v})} 
                  />
                  <View style={styles.inputRow}>
                    <TextInput 
                      style={[styles.input, { flex: 1, color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} 
                      placeholder={t.firstName} 
                      placeholderTextColor={colors.textSecondary} 
                      value={editForm.firstName} 
                      onChangeText={v => setEditForm({...editForm, firstName: v})} 
                    />
                    <TextInput 
                      style={[styles.input, { flex: 1, color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} 
                      placeholder={t.lastName} 
                      placeholderTextColor={colors.textSecondary} 
                      value={editForm.lastName} 
                      onChangeText={v => setEditForm({...editForm, lastName: v})} 
                    />
                  </View>
                  <TextInput 
                    style={[styles.input, styles.textArea, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} 
                    placeholder={t.bio} 
                    placeholderTextColor={colors.textSecondary} 
                    multiline 
                    value={editForm.bio} 
                    onChangeText={v => setEditForm({...editForm, bio: v})} 
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity style={[styles.miniBtn, { backgroundColor: colors.cardBorder }]} onPress={() => setEditing(false)}>
                      <X size={18} color="#fff" /><Text style={styles.btnText}>{t.back}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.miniBtn, { backgroundColor: '#238636' }]} onPress={handleSave}>
                      <Save size={18} color="#fff" /><Text style={styles.btnText}>{t.save}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={[styles.name, { color: colors.text }]}>
                    {user.firstName || user.username} {user.lastName || ''}
                  </Text>
                  
                  <Text style={[styles.bioText, { color: colors.textSecondary }]}>
                    {user.bio || 'Участник Z Network'}
                  </Text>
                  
                  {/* Followers & Following Stats Buttons */}
                  <View style={styles.stats}>
                    <TouchableOpacity style={styles.statItem} onPress={() => openUsersListModal('followers')}>
                      <Text style={[styles.statNum, { color: colors.text }]}>{user._count?.followers || 0}</Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t.followers}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.statItem} onPress={() => openUsersListModal('following')}>
                      <Text style={[styles.statNum, { color: colors.text }]}>{user._count?.following || 0}</Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t.following}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Actions Bar */}
                  <View style={styles.actions}>
                    {isOwnProfile ? (
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => setEditing(true)}>
                        <Edit3 size={18} color="#fff" />
                        <Text style={styles.btnText}>{t.editProfile}</Text>
                      </TouchableOpacity>
                    ) : (
                      <>
                        <TouchableOpacity 
                          style={[styles.actionBtn, { backgroundColor: user.isFollowing ? colors.cardBorder : colors.primary }]} 
                          onPress={handleFollow}
                          disabled={followingLoading}
                        >
                          {followingLoading ? <ActivityIndicator size="small" color="#fff" /> : 
                            <>
                              {user.isFollowing ? <UserMinus size={18} color="#fff" /> : <UserPlus size={18} color="#fff" />}
                              <Text style={styles.btnText}>{user.isFollowing ? t.unfollow : t.follow}</Text>
                            </>
                          }
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.cardBorder }]}>
                          <MessageCircle size={18} color="#fff" />
                          <Text style={styles.btnText}>{t.message}</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </>
              )}
            </Animated.View>

            {/* Privacy Lock Banner */}
            {user.isRestricted ? (
              <View style={[styles.privateProfileBox, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                <Lock size={40} color={colors.textSecondary} />
                <Text style={[styles.privateProfileTitle, { color: colors.text }]}>Это закрытый профиль</Text>
                <Text style={[styles.privateProfileSub, { color: colors.textSecondary }]}>
                  {t.restrictedProfile}
                </Text>
              </View>
            ) : (
              !editing && (
                <View style={styles.feedArea}>
                   <View style={styles.sectionHeader}>
                     <Text style={[styles.sectionTitle, { color: colors.text }]}>{t.posts}</Text>
                   </View>
                   {posts.length === 0 ? (
                     <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Пока нет публикаций</Text>
                   ) : (
                     posts.map((p) => (
                        <PostCard 
                          key={p.id}
                          post={p}
                          currentUser={currentUser}
                          t={t}
                          onShare={(item) => setShareItem(item)}
                          onPostDeleted={(id) => setPosts(posts.filter(item => item.id !== id))}
                          onPostUpdated={(updated) => setPosts(posts.map(item => item.id === updated.id ? updated : item))}
                        />
                     ))
                   )}
                </View>
              )
            )}
          </ScrollView>

          {/* Followers / Following List Modal */}
          <Modal visible={listModalType !== null} transparent animationType="slide">
            <TouchableOpacity style={styles.listModalOverlay} activeOpacity={1} onPress={() => setListModalType(null)}>
              <View style={[styles.listModalBox, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                <View style={styles.listModalHeader}>
                  <Text style={[styles.listModalTitle, { color: colors.text }]}>
                    {listModalType === 'followers' ? t.followers : t.following}
                  </Text>
                  <TouchableOpacity onPress={() => setListModalType(null)}>
                    <X size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 360 }}>
                  {listLoading ? (
                    <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
                  ) : usersList.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Список пуст</Text>
                  ) : (
                    usersList.map((u) => (
                      <TouchableOpacity 
                        key={u.id} 
                        style={[styles.userListItem, { borderBottomColor: colors.subtleBorder }]}
                        onPress={() => {
                          setListModalType(null);
                          router.push(`/profile/${u.username}`);
                        }}
                      >
                        <Image source={{ uri: getAvatarUrl(u.username, u.avatar) }} style={styles.userListAvatar} />
                        <View>
                          <Text style={[styles.userListName, { color: colors.text }]}>
                            {u.firstName || u.username} {u.lastName || ''}
                          </Text>
                          <Text style={[styles.userListHandle, { color: colors.textSecondary }]}>
                            @{u.username}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Share Sheet Modal */}
          <ShareSheet 
            visible={shareItem !== null} 
            item={shareItem} 
            onClose={() => setShareItem(null)} 
          />

          {!isDesktop && <Dock items={dockItems} activeTab={isOwnProfile ? "profile" : "other"} />}
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
  scrollContent: { paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  iconBtn: { padding: 8 },
  profileCard: { alignItems: 'center', padding: 28, borderRadius: 24, borderWidth: 1, margin: 12 },
  avatarWrapper: { position: 'relative', marginBottom: 14 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3 },
  name: { fontSize: 22, fontWeight: '900' },
  bioText: { textAlign: 'center', marginTop: 6, fontSize: 14, paddingHorizontal: 16 },
  stats: { flexDirection: 'row', gap: 36, marginTop: 20 },
  statItem: { alignItems: 'center' },
  statNum: { fontWeight: '800', fontSize: 18 },
  statLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 24, width: '100%', maxWidth: 380 },
  actionBtn: { flex: 1, flexDirection: 'row', height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  editForm: { width: '100%', gap: 10, marginTop: 10 },
  inputRow: { flexDirection: 'row', gap: 10 },
  input: { padding: 12, borderRadius: 8, borderWidth: 1, fontSize: 14 },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  miniBtn: { flex: 1, height: 40, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  feedArea: { padding: 12 },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  emptyText: { textAlign: 'center', marginVertical: 20, fontSize: 14 },
  
  // Private profile box
  privateProfileBox: { margin: 12, padding: 36, borderRadius: 24, borderWidth: 1, alignItems: 'center', gap: 10 },
  privateProfileTitle: { fontSize: 18, fontWeight: '800' },
  privateProfileSub: { fontSize: 13, textAlign: 'center' },

  // List Modal
  listModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  listModalBox: { width: '100%', maxWidth: 420, borderRadius: 20, borderWidth: 1, padding: 20 },
  listModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  listModalTitle: { fontSize: 16, fontWeight: '800' },
  userListItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  userListAvatar: { width: 38, height: 38, borderRadius: 19 },
  userListName: { fontWeight: '700', fontSize: 14 },
  userListHandle: { fontSize: 12 },

  // Not found screen
  notFoundBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  notFoundTitle: { fontSize: 20, fontWeight: '800' },
  notFoundSub: { fontSize: 14, textAlign: 'center' },
  backHomeBtn: { paddingHorizontal: 20, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  backHomeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 }
});