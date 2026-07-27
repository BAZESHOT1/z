import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, useWindowDimensions, ScrollView } from 'react-native';
import { Octicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeInRight, FadeOutLeft, Layout } from 'react-native-reanimated';
import { checkUsername, registerUser, setAuthToken } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RegisterScreen() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const { width } = useWindowDimensions();

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

  const StepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map(s => (
        <View key={s} style={[styles.dot, step >= s && styles.activeDot, step === s && styles.currentDot]} />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeInDown.duration(800)} layout={Layout} style={styles.card}>
          <View style={styles.cardHeader}>
             <TouchableOpacity style={styles.iconBtn} onPress={() => step > 1 ? setStep(step-1) : router.back()}>
               <Octicons name="arrow-left" size={20} color="#8b949e" />
             </TouchableOpacity>
             <StepIndicator />
             <View style={{ width: 40 }} />
          </View>

          <View style={styles.contentArea}>
            {step === 1 && (
              <Animated.View key="step1" entering={FadeInRight} exiting={FadeOutLeft}>
                <Text style={styles.stepTitle}>Как вас называть?</Text>
                <Text style={styles.stepSub}>Выберите уникальный логин для идентификации в Z-сети.</Text>
                
                <View style={styles.fieldWrapper}>
                  <TextInput 
                    style={[styles.input, available === false && styles.inputError]} 
                    placeholder="Username" 
                    placeholderTextColor="#484f58"
                    value={form.username}
                    onChangeText={v => { setForm({...form, username: v}); setAvailable(null); }}
                    autoCapitalize="none"
                  />
                  {available === false && <Text style={styles.errorHint}>Этот идентификатор уже занят другим узлом.</Text>}
                </View>

                <TouchableOpacity style={styles.nextBtn} onPress={nextStep} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextBtnText}>Подтвердить логин</Text>}
                </TouchableOpacity>
              </Animated.View>
            )}

            {step === 2 && (
              <Animated.View key="step2" entering={FadeInRight} exiting={FadeOutLeft}>
                <Text style={styles.stepTitle}>Канал связи</Text>
                <Text style={styles.stepSub}>Электронная почта используется для критических уведомлений и восстановления.</Text>
                
                <View style={styles.fieldWrapper}>
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
                <Text style={styles.stepTitle}>Протокол защиты</Text>
                <Text style={styles.stepSub}>Создайте надежный пароль для шифрования ваших данных.</Text>
                
                <View style={styles.fieldWrapper}>
                  <View style={styles.passBox}>
                    <TextInput 
                      style={styles.inputPass} 
                      placeholder="Придумайте пароль" 
                      placeholderTextColor="#484f58"
                      secureTextEntry={!showPass}
                      value={form.password}
                      onChangeText={v => setForm({...form, password: v})}
                    />
                    <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                      <Octicons name={showPass ? "eye-closed" : "eye"} size={20} color="#8b949e" />
                    </TouchableOpacity>
                  </View>
                  <TextInput 
                    style={[styles.input, { marginTop: 12 }]} 
                    placeholder="Повторите пароль" 
                    placeholderTextColor="#484f58"
                    secureTextEntry={!showPass}
                    value={form.confirm}
                    onChangeText={v => setForm({...form, confirm: v})}
                  />
                </View>

                <TouchableOpacity style={[styles.nextBtn, { backgroundColor: '#238636' }]} onPress={handleRegister} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextBtnText}>Активировать аккаунт</Text>}
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>

          <TouchableOpacity style={styles.footerLink} onPress={() => router.push('/auth/login')}>
            <Text style={styles.footerLinkText}>Уже есть аккаунт? <Text style={{ color: '#d66853' }}>Войти</Text></Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 440, backgroundColor: '#161b22', borderRadius: 28, padding: 28, borderWidth: 1, borderColor: '#30363d' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#0d1117', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#30363d' },
  stepIndicator: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#30363d' },
  activeDot: { backgroundColor: '#d66853', width: 24 },
  currentDot: { shadowColor: '#d66853', shadowOpacity: 0.8, shadowRadius: 10 },
  contentArea: { minHeight: 300 },
  stepTitle: { color: '#f0f6fc', fontSize: 26, fontWeight: '900', marginBottom: 12, letterSpacing: -0.5 },
  stepSub: { color: '#8b949e', fontSize: 15, lineHeight: 22, marginBottom: 32 },
  fieldWrapper: { marginBottom: 32 },
  input: { backgroundColor: '#0d1117', borderRadius: 16, borderWidth: 1, borderColor: '#30363d', height: 58, paddingHorizontal: 18, color: '#f0f6fc', fontSize: 16 },
  inputError: { borderColor: '#f85149' },
  errorHint: { color: '#f85149', fontSize: 12, marginTop: 8, marginLeft: 4, fontWeight: '600' },
  passBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d1117', borderRadius: 16, borderWidth: 1, borderColor: '#30363d', height: 58, paddingHorizontal: 18 },
  inputPass: { flex: 1, color: '#f0f6fc', fontSize: 16, height: '100%' },
  nextBtn: { backgroundColor: '#d66853', height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center', shadowColor: '#d66853', shadowOpacity: 0.3, shadowRadius: 12 },
  nextBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  footerLink: { marginTop: 32, alignItems: 'center' },
  footerLinkText: { color: '#8b949e', fontSize: 14, fontWeight: '600' }
});