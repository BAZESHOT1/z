import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { ArrowLeft, Globe, LogOut, Sun, Moon } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { translations } from './i18n';
import { useTheme } from './themeContext';
import { setAuthToken, fetchCurrentUser, updateProfile } from './api';

export default function SettingsScreen() {
  const { colors, theme, toggleTheme, lang, setLanguage } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const t = translations[lang];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await fetchCurrentUser();
      setUser(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguage = () => {
    setLanguage(lang === 'ru' ? 'en' : 'ru');
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

  if (loading) return <View style={[styles.center, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.primary} /></View>;
  if (!user) return <View style={[styles.center, { backgroundColor: colors.bg }]}><Text style={{color: colors.text}}>Error loading profile</Text></View>;

  const PrivacyRow = ({ label, field }: { label: string, field: string }) => {
    const val = user[field] || 'EVERYONE';
    const capitalizedVal = val.charAt(0) + val.slice(1).toLowerCase();
    const translationKey = `privacy${capitalizedVal}` as keyof typeof t;
    
    return (
      <TouchableOpacity style={styles.row} onPress={() => cyclePrivacy(field)}>
        <Text style={[styles.rowText, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.valText, { color: colors.primary }]}>{t[translationKey] || val}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderColor: colors.cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={colors.text} size={22} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{t.settings}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.systemSettings}</Text>
        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          
          {/* Theme Switcher */}
          <TouchableOpacity style={styles.row} onPress={toggleTheme}>
            <View style={styles.rowLeft}>
              {theme === 'dark' ? <Sun color="#fbbf24" size={20} /> : <Moon color="#6366f1" size={20} />}
              <Text style={[styles.rowText, { color: colors.text }]}>{t.theme}</Text>
            </View>
            <Text style={[styles.valText, { color: colors.primary }]}>
              {theme === 'dark' ? t.darkTheme : t.lightTheme}
            </Text>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.subtleBorder }]} />

          {/* Language Switcher */}
          <TouchableOpacity style={styles.row} onPress={toggleLanguage}>
            <View style={styles.rowLeft}>
              <Globe color={colors.textSecondary} size={20} />
              <Text style={[styles.rowText, { color: colors.text }]}>{t.language}</Text>
            </View>
            <Text style={[styles.valText, { color: colors.primary }]}>
              {lang === 'ru' ? 'Русский' : 'English'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.privacySettings}</Text>
        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <PrivacyRow label={t.privacyProfile} field="privacyProfile" />
          <View style={[styles.divider, { backgroundColor: colors.subtleBorder }]} />
          <PrivacyRow label={t.privacyMessages} field="privacyMessages" />
          <View style={[styles.divider, { backgroundColor: colors.subtleBorder }]} />
          <PrivacyRow label={t.privacyPosts} field="privacyPosts" />
        </View>

        <TouchableOpacity style={[styles.card, styles.logoutCard]} onPress={handleLogout}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <LogOut color="#f85149" size={20} />
              <Text style={[styles.rowText, { color: '#f85149' }]}>{t.signOut}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: '800' },
  content: { padding: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, marginLeft: 4, letterSpacing: 0.5 },
  card: { borderRadius: 16, marginBottom: 20, overflow: 'hidden', borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { fontSize: 15, fontWeight: '600' },
  valText: { fontWeight: '700', fontSize: 14 },
  divider: { height: 1, marginHorizontal: 16 },
  logoutCard: { marginTop: 10, borderColor: 'rgba(248, 81, 73, 0.3)' }
});