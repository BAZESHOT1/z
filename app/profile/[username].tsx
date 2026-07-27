import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, Edit3, MessageSquare, UserPlus, UserMinus, Grid, Image as ImageIcon, Calendar, Link as LinkIcon, Settings } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchUserProfile, fetchCurrentUser, updateProfile, toggleFollow, fetchPosts } from '../api';
import { translations, Language } from '../i18n';

export default function ProfileScreen() {
  const { username } = useLocalSearchParams();
  const [user, setUser] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [lang, setLang] = useState<Language>('ru');
  
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', bio: '', socialLinks: '', birthDate: '' });

  const isOwnProfile = currentUser?.username === username;
  const t = translations[lang];

  useEffect(() => {
    loadData();
  }, [username]);

  const loadData = async () => {
    const savedLang = await AsyncStorage.getItem('lang') as Language;
    if (savedLang) setLang(savedLang);

    try {
      const [profileData, currentData, postsData] = await Promise.all([
        fetchUserProfile(username as string),
        fetchCurrentUser(),
        fetchPosts(username as string)
      ]);
      setUser(profileData);
      setCurrentUser(currentData);
      setPosts(postsData || []);
      if (profileData) setEditForm({
        firstName: profileData.firstName || '',
        lastName: profileData.lastName || '',
        bio: profileData.bio || '',
        socialLinks: profileData.socialLinks || '',
        birthDate: profileData.birthDate || ''
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    await updateProfile(editForm);
    setEditing(false);
    loadData();
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color="#5353ff" /></View>
  );

  if (!user) return (
    <View style={styles.center}><Text style={{color: '#fff'}}>User not found</Text></View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>@{user.username}</Text>
        {isOwnProfile ? (
          <TouchableOpacity onPress={() => router.push('/settings')} style={styles.iconBtn}>
            <Settings color="#fff" size={24} />
          </TouchableOpacity>
        ) : <View style={{width: 40}} />}
      </View>

      <ScrollView>
        <View style={styles.profileHeader}>
          <Image source={{ uri: user.avatar || 'https://via.placeholder.com/150' }} style={styles.avatar} />
          
          {editing ? (
            <View style={styles.editForm}>
              <TextInput style={styles.input} value={editForm.firstName} onChangeText={t => setEditForm({...editForm, firstName: t})} placeholder={t.firstName} placeholderTextColor="#8b949e" />
              <TextInput style={styles.input} value={editForm.lastName} onChangeText={t => setEditForm({...editForm, lastName: t})} placeholder={t.lastName} placeholderTextColor="#8b949e" />
              <TextInput style={styles.input} value={editForm.bio} onChangeText={t => setEditForm({...editForm, bio: t})} placeholder={t.bio} placeholderTextColor="#8b949e" multiline />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}><Text style={styles.btnText}>{t.save}</Text></TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.name}>{user.firstName} {user.lastName}</Text>
              <Text style={styles.bio}>{user.bio || 'No bio yet'}</Text>
              
              <View style={styles.stats}>
                <View style={styles.statItem}><Text style={styles.statNum}>{user._count?.followers || 0}</Text><Text style={styles.statLabel}>{t.followers}</Text></View>
                <View style={styles.statItem}><Text style={styles.statNum}>{user._count?.following || 0}</Text><Text style={styles.statLabel}>{t.following}</Text></View>
              </View>

              <View style={styles.actions}>
                {isOwnProfile ? (
                  <TouchableOpacity style={styles.actionBtn} onPress={() => setEditing(true)}>
                    <Edit3 size={18} color="#fff" />
                    <Text style={styles.btnText}>{t.editProfile}</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity style={styles.actionBtn}>
                      <UserPlus size={18} color="#fff" />
                      <Text style={styles.btnText}>{t.follow}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, styles.msgBtn]}>
                      <MessageSquare size={18} color="#fff" />
                      <Text style={styles.btnText}>{t.message}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </>
          )}
        </View>

        <View style={styles.infoSection}>
          {user.birthDate && <View style={styles.infoRow}><Calendar size={16} color="#8b949e" /><Text style={styles.infoText}>{user.birthDate}</Text></View>}
          {user.socialLinks && <View style={styles.infoRow}><LinkIcon size={16} color="#8b949e" /><Text style={styles.infoText}>{user.socialLinks}</Text></View>}
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity style={styles.tabActive}><Text style={styles.tabText}>{t.posts}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.tab}><Text style={styles.tabText}>{t.media}</Text></TouchableOpacity>
        </View>

        <View style={styles.feed}>
          {posts.map(post => (
            <View key={post.id} style={styles.postCard}>
              <Text style={styles.postContent}>{post.content}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d1117' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#30363d' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  iconBtn: { padding: 8 },
  profileHeader: { alignItems: 'center', padding: 24 },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 16, borderWidth: 3, borderColor: '#5353ff' },
  name: { color: '#fff', fontSize: 22, fontWeight: '800' },
  bio: { color: '#8b949e', textAlign: 'center', marginTop: 8, fontSize: 14, paddingHorizontal: 20 },
  stats: { flexDirection: 'row', gap: 30, marginTop: 20 },
  statItem: { alignItems: 'center' },
  statNum: { color: '#fff', fontWeight: '700', fontSize: 16 },
  statLabel: { color: '#8b949e', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' },
  actionBtn: { flex: 1, backgroundColor: '#5353ff', flexDirection: 'row', height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  msgBtn: { backgroundColor: '#21262d', borderWidth: 1, borderColor: '#30363d' },
  btnText: { color: '#fff', fontWeight: '600' },
  infoSection: { paddingHorizontal: 24, gap: 10, marginBottom: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { color: '#8b949e', fontSize: 13 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#30363d' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabActive: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderColor: '#5353ff' },
  tabText: { color: '#fff', fontWeight: '600' },
  feed: { padding: 16 },
  postCard: { backgroundColor: '#161b22', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#30363d' },
  postContent: { color: '#c9d1d9', lineHeight: 20 },
  editForm: { width: '100%', gap: 12 },
  input: { backgroundColor: '#0d1117', color: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#30363d' },
  saveBtn: { backgroundColor: '#238636', height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }
});