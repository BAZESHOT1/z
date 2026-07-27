import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert, useWindowDimensions } from 'react-native';
import { Octicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { loginUser, setAuthToken } from '../api';

export default function LoginScreen() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const handleLogin = async () => {
    if (!form.username || !form.password) return;
    setLoading(true);
    try {
      const res = await loginUser(form);
      setAuthToken(res.token);
      await AsyncStorage.setItem('auth_token', res.token);
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Ошибка доступа', 'Проверьте логин или пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeInDown.duration(600)} style={[styles.card, isDesktop && styles.desktopCard]}>
        <View style={styles.logoContainer}>
          <View style={styles.logoBadge}><Octicons name="terminal" size={32} color="#fff" /></View>
          <Text style={styles.title}>Z Network</Text>
          <Text style={styles.subtitle}>Вход в децентрализованную сеть</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Логин</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Введите ваш логин" 
            placeholderTextColor="#8b949e"
            value={form.username}
            onChangeText={v => setForm({...form, username: v})}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Пароль</Text>
          <TextInput 
            style={styles.input} 
            placeholder="••••••••" 
            placeholderTextColor="#8b949e"
            secureTextEntry
            value={form.password}
            onChangeText={v => setForm({...form, password: v})}
          />
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Авторизоваться</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/auth/register')}>
          <Text style={styles.linkText}>Нет аккаунта? Зарегистрироваться</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 400, backgroundColor: '#161b22', borderRadius: 16, padding: 32, borderWidth: 1, borderColor: '#30363d' },
  desktopCard: { maxWidth: 450 },
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logoBadge: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#d66853', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { color: '#c9d1d9', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#8b949e', fontSize: 14, marginTop: 4 },
  inputGroup: { marginBottom: 20 },
  label: { color: '#c9d1d9', fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: '#0d1117', borderWidth: 1, borderColor: '#30363d', borderRadius: 8, padding: 12, color: '#c9d1d9' },
  primaryBtn: { backgroundColor: '#238636', height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  linkText: { color: '#d66853', textAlign: 'center', marginTop: 24, fontSize: 14, fontWeight: '500' }
});