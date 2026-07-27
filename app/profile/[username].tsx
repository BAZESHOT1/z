import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, ScrollView, Text, TouchableOpacity, ActivityIndicator, SafeAreaView, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, UserPlus, UserMinus, MessageCircle, Settings, Edit3, Calendar, Link as LinkIcon, Lock } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchUserProfile, fetchCurrentUser, updateProfile, fetchPosts, toggleFollow } from '../api';
import { translations, Language } from '../i18n';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

export default function ProfileScreen() {
  const { username } = useLocalSearchParams();
  const [user, setUser] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [lang, setLang] = useState<Language>('ru');
  const [followingLoading, setFollowingLoading] = useState(false);
  
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', bio: '', socialLinks: '', birthDate: '' });

  const isOwnProfile = currentUser?.username === username;
  const t = translations[lang];

  useEffect(() => { loadData(); }, [username]);

  const loadData = async () => {
    const savedLang = await AsyncStorage.getItem('lang') as Language;
    if (savedLang) setLang(savedLang);
    try {
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
          birthDate: profileData.birthDate || ''
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
    await updateProfile(editForm);
    setEditing(false);
    loadData();
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#5353ff" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><ArrowLeft color="#fff" size={24} /></TouchableOpacity>
        <Text style={styles.headerTitle}>@{user.username}</Text>
        {isOwnProfile ? (
          <TouchableOpacity onPress={() => router.push('/settings')} style={styles.iconBtn}><Settings color="#fff" size={24} /></TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn} style={styles.profileHeader}>
          <Image source={{ uri: user.avatar || 'https://via.placeholder.com/150' }} style={styles.avatar} />
          
          <Text style={styles.name}>{user.firstName || user.username} {user.lastName || ''}</Text>
          <Text style={styles.bio}>{user.bio || 'Digital Nomad'}</Text>
          
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
        </Animated.View>

        {!user.isRestricted && (
          <View style={styles.feedArea}>
             <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{t.posts}</Text></View>
             {posts.map((p, idx) => (
                <Animated.View key={p.id} entering={SlideInDown.delay(idx * 100)} style={styles.postCard}>
                  <Text style={styles.postContent}>{p.content}</Text>
                </Animated.View>
             ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d1117' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#30363d' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  iconBtn: { padding: 8 },
  profileHeader: { alignItems: 'center', padding: 32, backgroundColor: '#161b22', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  avatar: { width: 110, height: 110, borderRadius: 55, marginBottom: 16, borderWidth: 4, borderColor: '#5353ff' },
  name: { color: '#fff', fontSize: 24, fontWeight: '900' },
  bio: { color: '#8b949e', textAlign: 'center', marginTop: 8, fontSize: 15, paddingHorizontal: 40 },
  stats: { flexDirection: 'row', gap: 40, marginTop: 24 },
  statItem: { alignItems: 'center' },
  statNum: { color: '#fff', fontWeight: '800', fontSize: 18 },
  statLabel: { color: '#8b949e', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 32, width: '100%', maxWidth: 400 },
  actionBtn: { flex: 1, backgroundColor: '#5353ff', flexDirection: 'row', height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
  followingBtn: { backgroundColor: '#30363d' },
  msgBtn: { backgroundColor: '#21262d', borderWidth: 1, borderColor: '#30363d' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  feedArea: { padding: 20 },
  sectionHeader: { marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  postCard: { backgroundColor: '#161b22', padding: 20, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#30363d' },
  postContent: { color: '#c9d1d9', lineHeight: 22, fontSize: 15 }
});