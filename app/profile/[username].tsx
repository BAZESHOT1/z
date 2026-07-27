import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, ScrollView, Text, TouchableOpacity, ActivityIndicator, SafeAreaView, TextInput, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, UserPlus, UserMinus, MessageCircle, Settings, Edit3, Save, X, Home, MessageSquare, LayoutGrid, User as UserIcon } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchUserProfile, fetchCurrentUser, updateProfile, fetchPosts, toggleFollow, setAuthToken } from '../api';
import { translations, Language } from '../i18n';
import Animated, { FadeIn, SlideInDown, Layout } from 'react-native-reanimated';
import Sidebar from '../../components/Sidebar';
import Dock from '../../components/Dock';

export default function ProfileScreen() {
  const { username } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [user, setUser] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [lang, setLang] = useState<Language>('ru');
  const [followingLoading, setFollowingLoading] = useState(false);
  
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', bio: '', socialLinks: '', birthDate: '', avatar: '' });

  const isOwnProfile = currentUser?.username === username;
  const t = translations[lang];

  useEffect(() => { loadData(); }, [username]);

  const loadData = async () => {
    const savedLang = await AsyncStorage.getItem('lang') as Language;
    if (savedLang) setLang(savedLang);
    
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) setAuthToken(token);

      const [profileData, currentData] = await Promise.all([
        fetchUserProfile(username as string),
        fetchCurrentUser()
      ]);

      setUser(profileData);
      setCurrentUser(currentData);

      if (profileData) {
        if (!profileData.isRestricted) {
          const postsData = await fetchPosts(username as string);
          setPosts(postsData || []);
        }
        setEditForm({
          firstName: profileData.firstName || '',
          lastName: profileData.lastName || '',
          bio: profileData.bio || '',
          socialLinks: profileData.socialLinks || '',
          birthDate: profileData.birthDate || '',
          avatar: profileData.avatar || ''
        });
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleFollow = async () => {
    if (!currentUser) { router.push('/auth/login'); return; }
    setFollowingLoading(true);
    try {
      const res = await toggleFollow(user.id || user._id);
      setUser({ ...user, isFollowing: res.following, _count: { ...user._count, followers: user._count.followers + (res.following ? 1 : -1) } });
    } catch (e) {} finally { setFollowingLoading(false); }
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
    { id: 'feed', icon: <Home size={22} color="#7e8590" />, label: t.home, onClick: () => router.push('/') },
    { id: 'chats', icon: <MessageSquare size={22} color="#7e8590" />, label: t.chats, onClick: () => router.push('/') },
    { id: 'apps', icon: <LayoutGrid size={22} color="#7e8590" />, label: t.apps, onClick: () => router.push('/') },
    { id: 'profile', icon: <UserIcon size={22} color="#fff" />, label: t.profile, onClick: () => {} },
  ];

  if (loading && !user) return <View style={styles.center}><ActivityIndicator color="#5353ff" /></View>;
  if (!user) return <View style={styles.center}><Text style={{color: '#fff'}}>User not found</Text></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.shell, isDesktop && styles.desktopShell]}>
        {isDesktop && <Sidebar activeTab="profile" onTabPress={(tab) => tab === 'profile' ? null : router.push('/')} t={t} />}

        <View style={styles.content}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><ArrowLeft color="#fff" size={24} /></TouchableOpacity>
              <Text style={styles.headerTitle}>@{user.username}</Text>
              {isOwnProfile ? (
                <TouchableOpacity onPress={() => router.push('/settings')} style={styles.iconBtn}><Settings color="#fff" size={24} /></TouchableOpacity>
              ) : <View style={{ width: 40 }} />}
            </View>

            <Animated.View entering={FadeIn} style={styles.profileCard}>
              <View style={styles.avatarWrapper}>
                <Image source={{ uri: editForm.avatar || user.avatar || 'https://via.placeholder.com/150' }} style={styles.avatar} />
                {editing && (
                  <TouchableOpacity style={styles.avatarEditOverlay}>
                    <Text style={styles.avatarEditText}>Change</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {editing ? (
                <View style={styles.editForm}>
                  <View style={styles.inputRow}>
                    <TextInput 
                      style={[styles.input, { flex: 1 }]} 
                      placeholder={t.firstName} 
                      placeholderTextColor="#484f58" 
                      value={editForm.firstName} 
                      onChangeText={v => setEditForm({...editForm, firstName: v})} 
                    />
                    <TextInput 
                      style={[styles.input, { flex: 1 }]} 
                      placeholder={t.lastName} 
                      placeholderTextColor="#484f58" 
                      value={editForm.lastName} 
                      onChangeText={v => setEditForm({...editForm, lastName: v})} 
                    />
                  </View>
                  <TextInput 
                    style={[styles.input, styles.textArea]} 
                    placeholder={t.bio} 
                    placeholderTextColor="#484f58" 
                    multiline 
                    value={editForm.bio} 
                    onChangeText={v => setEditForm({...editForm, bio: v})} 
                  />
                  <TextInput 
                    style={styles.input} 
                    placeholder={t.socialLinks} 
                    placeholderTextColor="#484f58" 
                    value={editForm.socialLinks} 
                    onChangeText={v => setEditForm({...editForm, socialLinks: v})} 
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity style={[styles.miniBtn, styles.cancelBtn]} onPress={() => setEditing(false)}>
                      <X size={18} color="#fff" /><Text style={styles.btnText}>{t.back}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.miniBtn, styles.saveBtn]} onPress={handleSave}>
                      <Save size={18} color="#fff" /><Text style={styles.btnText}>{t.save}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.name}>{user.firstName || user.username} {user.lastName || ''}</Text>
                  <Text style={styles.bioText}>{user.bio || 'Digital Nomad'}</Text>
                  
                  <View style={styles.stats}>
                    <View style={styles.statItem}><Text style={styles.statNum}>{user._count?.followers || 0}</Text><Text style={styles.statLabel}>{t.followers}</Text></View>
                    <View style={styles.statItem}><Text style={styles.statNum}>{user._count?.following || 0}</Text><Text style={styles.statLabel}>{t.following}</Text></View>
                  </View>

                  <View style={styles.actions}>
                    {isOwnProfile ? (
                      <TouchableOpacity style={styles.actionBtn} onPress={() => setEditing(true)}><Edit3 size={18} color="#fff" /><Text style={styles.btnText}>{t.editProfile}</Text></TouchableOpacity>
                    ) : (
                      <>
                        <TouchableOpacity 
                          style={[styles.actionBtn, user.isFollowing && styles.followingBtn]} 
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
                        <TouchableOpacity style={[styles.actionBtn, styles.msgBtn]}><MessageCircle size={18} color="#fff" /><Text style={styles.btnText}>{t.message}</Text></TouchableOpacity>
                      </>
                    )}
                  </View>
                </>
              )}
            </Animated.View>

            {!user.isRestricted && !editing && (
              <View style={styles.feedArea}>
                 <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{t.posts}</Text></View>
                 {posts.length === 0 ? (
                   <Text style={styles.emptyText}>No posts yet</Text>
                 ) : (
                   posts.map((p, idx) => (
                      <Animated.View key={p.id} entering={SlideInDown.delay(idx * 100)} style={styles.postCard}>
                        <Text style={styles.postContent}>{p.content}</Text>
                        <Text style={styles.postDate}>{new Date(p.createdAt).toLocaleDateString()}</Text>
                      </Animated.View>
                   ))
                 )}
              </View>
            )}
          </ScrollView>
          {!isDesktop && <Dock items={dockItems} activeTab="profile" />}
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
  scrollContent: { paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d1117' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#30363d' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  iconBtn: { padding: 8 },
  profileCard: { alignItems: 'center', padding: 32, backgroundColor: '#161b22', borderBottomLeftRadius: 32, borderBottomRightRadius: 32, borderWidth: 1, borderColor: '#30363d', margin: 10 },
  avatarWrapper: { position: 'relative', marginBottom: 16 },
  avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 4, borderColor: '#5353ff' },
  avatarEditOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 55, justifyContent: 'center', alignItems: 'center' },
  avatarEditText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  name: { color: '#fff', fontSize: 24, fontWeight: '900' },
  bioText: { color: '#8b949e', textAlign: 'center', marginTop: 8, fontSize: 15, paddingHorizontal: 20 },
  stats: { flexDirection: 'row', gap: 40, marginTop: 24 },
  statItem: { alignItems: 'center' },
  statNum: { color: '#fff', fontWeight: '800', fontSize: 18 },
  statLabel: { color: '#8b949e', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 32, width: '100%', maxWidth: 400 },
  actionBtn: { flex: 1, backgroundColor: '#5353ff', flexDirection: 'row', height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
  followingBtn: { backgroundColor: '#30363d' },
  msgBtn: { backgroundColor: '#21262d', borderWidth: 1, borderColor: '#30363d' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  editForm: { width: '100%', gap: 12, marginTop: 10 },
  inputRow: { flexDirection: 'row', gap: 10 },
  input: { backgroundColor: '#0d1117', color: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#30363d', fontSize: 14 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  miniBtn: { flex: 1, height: 44, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  cancelBtn: { backgroundColor: '#30363d' },
  saveBtn: { backgroundColor: '#238636' },
  feedArea: { padding: 20 },
  sectionHeader: { marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  postCard: { backgroundColor: '#161b22', padding: 20, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#30363d' },
  postContent: { color: '#c9d1d9', lineHeight: 22, fontSize: 15 },
  postDate: { color: '#484f58', fontSize: 12, marginTop: 10 },
  emptyText: { color: '#484f58', textAlign: 'center', marginTop: 20 },
});