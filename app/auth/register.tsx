import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert, useWindowDimensions } from 'react-native';
import { Octicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { checkUsername, registerUser, setAuthToken } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RegisterScreen() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  const nextStep = async () => {
    if (step === 1) {
      if (form.username.length < 3) return;
      setLoading(true);
      const res = await checkUsername(form.username);
      setLoading(false);
      if (!res.available) {
        Alert.alert('Ошибка', 'Этот логин уже занят');
        return;
      }
      setAvailable(true);
    }
    if (step === 2 && !form.email.includes('@')) return;
    setStep(step + 1);
  };

  const handleRegister = async () => {
    if (form.password !== form.confirm) {
      Alert.alert('Ошибка', 'Пароли не совпадают');
      return;
    }
    setLoading(true);
    try {
      const res = await registerUser({ ...form, firstName: form.username });
      setAuthToken(res.token);
      await AsyncStorage.setItem('auth_token', res.token);
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Системная ошибка', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : router.back()}>
            <Octicons name="arrow-left" size={20} color="#8b949e" />
          </TouchableOpacity>
          <Text style={styles.stepTitle}>Шаг {step} из 3</Text>
          <View style={{ width: 20 }} />
        </View>

        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${(step / 3) * 100}%` }]} />
        </View>

        {step === 1 && (
          <Animated.View entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
            <Text style={styles.title}>Придумайте логин</Text>
            <Text style={styles.desc}>Это ваш уникальный идентификатор в сети Z</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Username" 
              placeholderTextColor="#8b949e"
              value={form.username}
              onChangeText={v => setForm({...form, username: v})}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={nextStep} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Далее</Text>}
            </TouchableOpacity>
          </Animated.View>
        )}

        {step === 2 && (
          <Animated.View entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
            <Text style={styles.title}>Электронная почта</Text>
            <Text style={styles.desc}>Нужна для восстановления доступа и безопасности</Text>
            <TextInput 
              style={styles.input} 
              placeholder="email@example.com" 
              placeholderTextColor="#8b949e"
              keyboardType="email-address"
              value={form.email}
              onChangeText={v => setForm({...form, email: v})}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={nextStep}>
              <Text style={styles.btnText}>Далее</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {step === 3 && (
          <Animated.View entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
            <Text style={styles.title}>Защита аккаунта</Text>
            <Text style={styles.desc}>Используйте сложный пароль</Text>
            <View style={styles.passInputWrapper}>
              <TextInput 
                style={styles.input} 
                placeholder="Придумайте пароль" 
                placeholderTextColor="#8b949e"
                secureTextEntry={!showPass}
                value={form.password}
                onChangeText={v => setForm({...form, password: v})}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
                <Octicons name={showPass ? "eye-closed" : "eye"} size={16} color="#8b949e" />
              </TouchableOpacity>
            </View>
            <TextInput 
              style={styles.input} 
              placeholder="Повторите пароль" 
              placeholderTextColor="#8b949e"
              secureTextEntry={!showPass}
              value={form.confirm}
              onChangeText={v => setForm({...form, confirm: v})}
            />
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#238636' }]} onPress={handleRegister} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Создать аккаунт</Text>}
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#161b22', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#30363d' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  stepTitle: { color: '#8b949e', fontSize: 13, fontWeight: '600' },
  progressContainer: { height: 4, backgroundColor: '#0d1117', borderRadius: 2, marginBottom: 32, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#d66853' },
  stepContent: { width: '100%' },
  title: { color: '#c9d1d9', fontSize: 22, fontWeight: '800', marginBottom: 8 },
  desc: { color: '#8b949e', fontSize: 14, marginBottom: 24 },
  input: { backgroundColor: '#0d1117', borderWidth: 1, borderColor: '#30363d', borderRadius: 8, padding: 12, color: '#c9d1d9', marginBottom: 16 },
  passInputWrapper: { position: 'relative' },
  eyeBtn: { position: 'absolute', right: 12, top: 14 },
  primaryBtn: { backgroundColor: '#d66853', height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700' }
});