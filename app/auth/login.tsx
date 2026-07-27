import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, useWindowDimensions, ScrollView } from 'react-native';
import { Octicons } from '@expo/vector-icons';
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
      setError('Неверные учетные данные. Пожалуйста, попробуйте еще раз.');
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
            <Octicons name="arrow-left" size={20} color="#8b949e" />
          </TouchableOpacity>

          <View style={styles.logoArea}>
            <View style={styles.logoBox}>
              <Octicons name="terminal" size={32} color="#fff" />
            </View>
            <Text style={styles.welcomeTitle}>С возвращением</Text>
            <Text style={styles.welcomeSub}>Войдите, чтобы продолжить работу в Z</Text>
          </View>

          {error && (
            <Animated.View entering={FadeInDown} style={styles.errorBox}>
              <Octicons name="alert" size={16} color="#f85149" />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          )}

          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Уникальный идентификатор</Text>
              <View style={styles.field}>
                <Octicons name="person" size={18} color="#8b949e" style={styles.fieldIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Username" 
                  placeholderTextColor="#484f58"
                  value={form.username}
                  onChangeText={v => setForm({...form, username: v})}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Секретный код</Text>
              <View style={styles.field}>
                <Octicons name="lock" size={18} color="#8b949e" style={styles.fieldIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Password" 
                  placeholderTextColor="#484f58"
                  secureTextEntry
                  value={form.password}
                  onChangeText={v => setForm({...form, password: v})}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.mainBtn} onPress={handleLogin} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainBtnText}>Войти в систему</Text>}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>ИЛИ</Text>
              <View style={styles.line} />
            </View>

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
  bgGlow: { position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: 'rgba(214, 104, 83, 0.05)', filter: 'blur(100px)' } as any,
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 440, backgroundColor: '#161b22', borderRadius: 24, padding: 32, borderWidth: 1, borderColor: '#30363d', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 20 } },
  desktopCard: { padding: 48 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 20, padding: 8, borderRadius: 10, backgroundColor: '#0d1117', borderWidth: 1, borderColor: '#30363d' },
  logoArea: { alignItems: 'center', marginBottom: 40 },
  logoBox: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#d66853', justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: '#d66853', shadowOpacity: 0.4, shadowRadius: 15 },
  welcomeTitle: { color: '#f0f6fc', fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  welcomeSub: { color: '#8b949e', fontSize: 15, marginTop: 8, textAlign: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(248, 81, 73, 0.1)', padding: 12, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(248, 81, 73, 0.2)' },
  errorText: { color: '#f85149', fontSize: 13, fontWeight: '600' },
  form: { gap: 24 },
  inputWrapper: { gap: 8 },
  inputLabel: { color: '#8b949e', fontSize: 13, fontWeight: '700', marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  field: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d1117', borderRadius: 14, borderWidth: 1, borderColor: '#30363d', height: 54, paddingHorizontal: 16 },
  fieldIcon: { marginRight: 12 },
  input: { flex: 1, color: '#f0f6fc', fontSize: 16, height: '100%' },
  mainBtn: { backgroundColor: '#238636', height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: '#238636', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  mainBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 15, marginVertical: 10 },
  line: { flex: 1, height: 1, backgroundColor: '#30363d' },
  dividerText: { color: '#484f58', fontSize: 12, fontWeight: '800' },
  secondaryBtn: { height: 56, borderRadius: 14, borderWidth: 1, borderColor: '#30363d', justifyContent: 'center', alignItems: 'center', backgroundColor: '#161b22' },
  secondaryBtnText: { color: '#c9d1d9', fontWeight: '700', fontSize: 15 }
});