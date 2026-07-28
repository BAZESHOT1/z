import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, useWindowDimensions, ScrollView } from 'react-native';
import { ArrowLeft, User, Lock, AlertCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import { loginUser, setAuthToken } from '../api';

export default function LoginScreen() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const handleLogin = async () => {
    if (!form.username || !form.password) return;
    setLoading(true);
    setError(null);
    try {
      const res = await loginUser(form);
      setAuthToken(res.token);
      await AsyncStorage.setItem('auth_token', res.token);
      router.replace('/');
    } catch (e: any) {
      setError('Неверный логин или пароль. Попробуйте еще раз.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeInUp.delay(200)} style={styles.bgGlow} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeInDown.duration(800)} layout={Layout} style={[styles.card, isDesktop && styles.desktopCard]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={20} color="#8b949e" />
          </TouchableOpacity>

          <View style={styles.logoArea}>
            <View style={styles.logoBox}>
              <Text style={styles.zLogoText}>Z</Text>
            </View>
            <Text style={styles.welcomeTitle}>Вход в Z Network</Text>
            <Text style={styles.welcomeSub}>Введите свои данные для доступа к сети</Text>
          </View>

          {error && (
            <Animated.View entering={FadeInDown} style={styles.errorBox}>
              <AlertCircle size={16} color="#f85149" /><Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          )}

          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Логин (Username)</Text>
              <View style={styles.field}>
                <User size={18} color="#8b949e" style={styles.fieldIcon} />
                <TextInput style={styles.input} placeholder="Напр. ivan_dev" placeholderTextColor="#484f58" value={form.username} onChangeText={v => setForm({...form, username: v})} autoCapitalize="none" />
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Пароль</Text>
              <View style={styles.field}>
                <Lock size={18} color="#8b949e" style={styles.fieldIcon} />
                <TextInput style={styles.input} placeholder="Ваш секретный пароль" placeholderTextColor="#484f58" secureTextEntry value={form.password} onChangeText={v => setForm({...form, password: v})} />
              </View>
            </View>

            <TouchableOpacity style={styles.mainBtn} onPress={handleLogin} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainBtnText}>Войти</Text>}
            </TouchableOpacity>

            <View style={styles.divider}><View style={styles.line} /><Text style={styles.dividerText}>ИЛИ</Text><View style={styles.line} /></View>

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/auth/register')}>
              <Text style={styles.secondaryBtnText}>Создать новый аккаунт</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  bgGlow: { position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: 'rgba(37, 99, 235, 0.08)' } as any,
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#161b22', borderRadius: 20, padding: 32, borderWidth: 1, borderColor: '#30363d' },
  desktopCard: { padding: 40 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 20, padding: 8 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoBox: { width: 60, height: 60, borderRadius: 16, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  zLogoText: { color: '#fff', fontSize: 32, fontWeight: '900' },
  welcomeTitle: { color: '#f0f6fc', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  welcomeSub: { color: '#8b949e', fontSize: 14, marginTop: 4, textAlign: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(248, 81, 73, 0.1)', padding: 12, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(248, 81, 73, 0.2)' },
  errorText: { color: '#f85149', fontSize: 13 },
  form: { gap: 20 },
  inputWrapper: { gap: 8 },
  inputLabel: { color: '#f0f6fc', fontSize: 14, fontWeight: '600', marginLeft: 2 },
  field: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d1117', borderRadius: 10, borderWidth: 1, borderColor: '#30363d', height: 46, paddingHorizontal: 12 },
  fieldIcon: { marginRight: 10 },
  input: { flex: 1, color: '#f0f6fc', fontSize: 14 },
  mainBtn: { backgroundColor: '#2563eb', height: 46, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  mainBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  line: { flex: 1, height: 1, backgroundColor: '#30363d' },
  dividerText: { color: '#484f58', fontSize: 12, fontWeight: '600' },
  secondaryBtn: { height: 46, borderRadius: 10, borderWidth: 1, borderColor: '#30363d', justifyContent: 'center', alignItems: 'center', backgroundColor: '#21262d' },
  secondaryBtnText: { color: '#c9d1d9', fontWeight: '600', fontSize: 14 }
});