import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { ArrowLeft, Globe, LogOut } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { translations, Language } from './i18n';
import { setAuthToken, fetchCurrentUser, updateProfile } from './api';

export default function SettingsScreen() {
  const [lang, setLang] = useState<Language>('ru');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const t = translations[lang];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedLang = await AsyncStorage.getItem('lang') as Language;
      if (savedLang) setLang(savedLang);
      const data = await fetchCurrentUser();
      setUser(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguage = async () => {
    const newLang = lang === 'ru' ? 'en' : 'ru';
    setLang(newLang);
    await AsyncStorage.setItem('lang', newLang);
  };

  const cyclePrivacy = async (field: string) => {
    const levels = ['EVERYONE', 'FRIENDS', 'NOBODY'];
    const currentVal = user[field] || 'EVERYONE';
    const currentIdx = levels.indexOf(currentVal);
    const nextLevel = levels[(currentIdx + 1) % levels.length];
    
    const updated = { ...user, [field]: nextLevel };
    setUser(updated);
    try {
      await updateProfile(updated);
    } catch (e) {
      console.error('Privacy update error:', e);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('auth_token');
    setAuthToken(null);
    router.replace('/auth/login');
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#5353ff" /></View>;
  if (!user) return <View style={styles.center}><Text style={{color: '#fff'}}>Error loading profile</Text></View>;

  const PrivacyRow = ({ label, field }: { label: string, field: string }) => {
    const val = user[field] || 'EVERYONE';
    const capitalizedVal = val.charAt(0) + val.slice(1).toLowerCase();
    const translationKey = `privacy${capitalizedVal}` as keyof typeof t;
    
    return (
      <TouchableOpacity style={styles.row} onPress={() => cyclePrivacy(field)}>
        <Text style={styles.rowText}>{label}</Text>
        <Text style={styles.valText}>{t[translationKey] || val}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ArrowLeft color="#fff" size={24} /></TouchableOpacity>
        <Text style={styles.title}>{t.settings}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>{t.systemSettings}</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={toggleLanguage}>
            <View style={styles.rowLeft}><Globe color="#8b949e" size={20} /><Text style={styles.rowText}>{t.language}</Text></View>
            <Text style={styles.valText}>{lang === 'ru' ? 'Русский' : 'English'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>{t.privacySettings}</Text>
        <View style={styles.card}>
          <PrivacyRow label={t.privacyProfile} field="privacyProfile" />
          <View style={styles.divider} />
          <PrivacyRow label={t.privacyMessages} field="privacyMessages" />
          <View style={styles.divider} />
          <PrivacyRow label={t.privacyPosts} field="privacyPosts" />
        </View>

        <TouchableOpacity style={[styles.card, styles.logoutCard]} onPress={handleLogout}>
          <View style={styles.row}>
            <View style={styles.rowLeft}><LogOut color="#f85149" size={20} /><Text style={[styles.rowText, { color: '#f85149' }]}>{t.signOut}</Text></View>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d1117' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
  backBtn: { padding: 4 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  content: { padding: 20 },
  sectionTitle: { color: '#8b949e', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: '#161b22', borderRadius: 12, marginBottom: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#30363d' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  valText: { color: '#5353ff', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#30363d', marginHorizontal: 16 },
  logoutCard: { marginTop: 20, borderColor: 'rgba(248, 81, 73, 0.3)' }
});