import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, useWindowDimensions, ScrollView } from 'react-native';
import { Octicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInRight, FadeOutLeft, Layout } from 'react-native-reanimated';
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
      try {
        const res = await checkUsername(form.username);
        if (!res.available) {
           setAvailable(false);
           return;
        }
        setAvailable(true);
        setStep(2);
      } catch(e) {} finally { setLoading(false); }
    } else if (step === 2) {
      if (form.email.includes('@')) setStep(3);
    }
  };

  const handleRegister = async () => {
    if (form.password !== form.confirm) return;
    setLoading(true);
    try {
      const res = await registerUser({ ...form, firstName: form.username });
      setAuthToken(res.token);
      await AsyncStorage.setItem('auth_token', res.token);
      router.replace('/');
    } catch (e) {} finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View layout={Layout} style={styles.card}>
          <View style={styles.cardHeader}>
             <TouchableOpacity style={styles.iconBtn} onPress={() => step > 1 ? setStep(step-1) : router.back()}>
               <Octicons name="arrow-left" size={18} color="#8b949e" />
             </TouchableOpacity>
             <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
             </View>
             <Text style={styles.stepCounter}>{step}/3</Text>
          </View>

          <View style={styles.contentArea}>
            {step === 1 && (
              <Animated.View key="step1" entering={FadeInRight} exiting={FadeOutLeft}>
                <Text style={styles.stepTitle}>Начнем с логина</Text>
                <Text style={styles.stepSub}>Это ваше имя в системе Z. Оно должно быть уникальным.</Text>
                
                <View style={styles.inputWrapper}>
                  <Text style={styles.label}>Имя пользователя</Text>
                  <TextInput 
                    style={[styles.input, available === false && styles.inputError]} 
                    placeholder="Напр. developer_z" 
                    placeholderTextColor="#484f58"
                    value={form.username}
                    onChangeText={v => { setForm({...form, username: v}); setAvailable(null); }}
                    autoCapitalize="none"
                  />
                  {available === false && <Text style={styles.errorHint}>Логин уже занят</Text>}
                </View>

                <TouchableOpacity style={styles.nextBtn} onPress={nextStep} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextBtnText}>Продолжить</Text>}
                </TouchableOpacity>
              </Animated.View>
            )}

            {step === 2 && (
              <Animated.View key="step2" entering={FadeInRight} exiting={FadeOutLeft}>
                <Text style={styles.stepTitle}>Контактные данные</Text>
                <Text style={styles.stepSub}>Email необходим для защиты и восстановления аккаунта.</Text>
                
                <View style={styles.inputWrapper}>
                  <Text style={styles.label}>Электронная почта</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="email@example.com" 
                    placeholderTextColor="#484f58"
                    keyboardType="email-address"
                    value={form.email}
                    onChangeText={v => setForm({...form, email: v})}
                    autoCapitalize="none"
                  />
                </View>

                <TouchableOpacity style={styles.nextBtn} onPress={nextStep}>
                  <Text style={styles.nextBtnText}>Продолжить</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {step === 3 && (
              <Animated.View key="step3" entering={FadeInRight} exiting={FadeOutLeft}>
                <Text style={styles.stepTitle}>Безопасность</Text>
                <Text style={styles.stepSub}>Создайте надежный пароль для доступа к вашему узлу.</Text>
                
                <View style={styles.inputWrapper}>
                  <Text style={styles.label}>Новый пароль</Text>
                  <View style={styles.passField}>
                    <TextInput 
                      style={styles.inputBase} 
                      placeholder="Минимум 8 символов" 
                      placeholderTextColor="#484f58"
                      secureTextEntry={!showPass}
                      value={form.password}
                      onChangeText={v => setForm({...form, password: v})}
                    />
                    <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                      <Octicons name={showPass ? "eye-closed" : "eye"} size={16} color="#8b949e" />
                    </TouchableOpacity>
                  </View>
                  
                  <Text style={[styles.label, { marginTop: 12 }]}>Повторите пароль</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="Подтверждение пароля" 
                    placeholderTextColor="#484f58"
                    secureTextEntry={!showPass}
                    value={form.confirm}
                    onChangeText={v => setForm({...form, confirm: v})}
                  />
                </View>

                <TouchableOpacity style={[styles.nextBtn, { backgroundColor: '#238636' }]} onPress={handleRegister} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextBtnText}>Создать аккаунт</Text>}
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>

          <TouchableOpacity style={styles.footerLink} onPress={() => router.push('/auth/login')}>
            <Text style={styles.footerText}>Уже есть узел? <Text style={{ color: '#58a6ff' }}>Войти</Text></Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#161b22', borderRadius: 12, padding: 28, borderWidth: 1, borderColor: '#30363d' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 32 },
  iconBtn: { padding: 4 },
  progressTrack: { flex: 1, height: 4, backgroundColor: '#0d1117', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#238636' },
  stepCounter: { color: '#8b949e', fontSize: 12, fontWeight: '700' },
  contentArea: { minHeight: 320 },
  stepTitle: { color: '#f0f6fc', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  stepSub: { color: '#8b949e', fontSize: 14, lineHeight: 20, marginBottom: 24 },
  inputWrapper: { marginBottom: 24 },
  label: { color: '#f0f6fc', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { backgroundColor: '#0d1117', borderRadius: 6, borderWidth: 1, borderColor: '#30363d', height: 44, paddingHorizontal: 12, color: '#f0f6fc', fontSize: 14 },
  inputError: { borderColor: '#f85149' },
  errorHint: { color: '#f85149', fontSize: 12, marginTop: 6 },
  passField: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d1117', borderRadius: 6, borderWidth: 1, borderColor: '#30363d', height: 44, paddingHorizontal: 12 },
  inputBase: { flex: 1, color: '#f0f6fc', fontSize: 14 },
  nextBtn: { backgroundColor: '#21262d', height: 44, borderRadius: 6, borderWidth: 1, borderColor: '#30363d', justifyContent: 'center', alignItems: 'center' },
  nextBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  footerLink: { marginTop: 24, alignItems: 'center' },
  footerText: { color: '#8b949e', fontSize: 14 }
});