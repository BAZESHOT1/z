import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, ScrollView } from 'react-native';
import { ArrowLeft, User, Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { router } from 'expo-router';
import Animated, { FadeInRight, FadeOutLeft, Layout } from 'react-native-reanimated';
import { checkUsername, registerUser, setAuthToken } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Language } from '../i18n';

export default function RegisterScreen() {
  const [step, setStep] = useState(0); // 0: language, 1: username, 2: email, 3: password
  const [lang, setLang] = useState<Language>('ru');
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const t = translations[lang];

  const nextStep = async () => {
    setErrorMsg(null);
    if (step === 0) {
      await AsyncStorage.setItem('lang', lang);
      setStep(1);
    } else if (step === 1) {
      if (form.username.trim().length < 3) {
        setErrorMsg('Логин должен быть минимум 3 символа');
        return;
      }
      setLoading(true);
      try {
        const res = await checkUsername(form.username.trim());
        if (res && !res.available) { 
          setAvailable(false); 
          setErrorMsg('Этот логин уже занят');
          return; 
        }
        setAvailable(true); 
        setStep(2);
      } catch(e: any) {
        setStep(2); // В случае недоступности проверки позволяем продолжить
      } finally { 
        setLoading(false); 
      }
    } else if (step === 2) {
      if (!form.email.includes('@')) {
        setErrorMsg('Введите корректный email');
        return;
      }
      setStep(3);
    }
  };

  const handleRegister = async () => {
    if (!form.password || form.password.length < 4) {
      setErrorMsg('Пароль слишком короткий (минимум 4 символа)');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await registerUser({ 
        username: form.username.trim(), 
        email: form.email.trim(), 
        password: form.password, 
        firstName: form.username.trim() 
      });
      if (res && res.token) {
        setAuthToken(res.token);
        await AsyncStorage.setItem('auth_token', res.token);
        router.replace('/');
      } else {
        setErrorMsg(res?.error || 'Ошибка при регистрации');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Не удалось зарегистрироваться');
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View layout={Layout} style={styles.card}>
          <View style={styles.cardHeader}>
             <TouchableOpacity style={styles.iconBtn} onPress={() => step > 0 ? setStep(step - 1) : router.back()}>
               <ArrowLeft size={20} color="#8b949e" />
             </TouchableOpacity>
             <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
             </View>
             <Text style={styles.stepCounter}>{step}/3</Text>
          </View>

          {errorMsg && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{errorMsg}</Text>
            </View>
          )}

          <View style={styles.contentArea}>
            {step === 0 && (
              <Animated.View key="step0" entering={FadeInRight} exiting={FadeOutLeft}>
                <Text style={styles.stepTitle}>{t.selectLanguage}</Text>
                <View style={styles.langGrid}>
                  <TouchableOpacity style={[styles.langBtn, lang === 'ru' && styles.langBtnActive]} onPress={() => setLang('ru')}>
                    <Text style={styles.langText}>Русский</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.langBtn, lang === 'en' && styles.langBtnActive]} onPress={() => setLang('en')}>
                    <Text style={styles.langText}>English</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.nextBtn} onPress={nextStep}>
                  <Text style={styles.nextBtnText}>{t.next}</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {step === 1 && (
              <Animated.View key="step1" entering={FadeInRight} exiting={FadeOutLeft}>
                <Text style={styles.stepTitle}>{t.username}</Text>
                <View style={styles.inputWrapper}>
                  <View style={styles.field}>
                    <User size={18} color="#8b949e" style={styles.fieldIcon} />
                    <TextInput 
                      style={[styles.input, available === false && styles.inputError]} 
                      placeholder="Username" 
                      placeholderTextColor="#484f58" 
                      value={form.username} 
                      onChangeText={v => { setForm({...form, username: v}); setAvailable(null); }} 
                      autoCapitalize="none" 
                    />
                  </View>
                </View>
                <TouchableOpacity style={styles.nextBtn} onPress={nextStep} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextBtnText}>{t.next}</Text>}
                </TouchableOpacity>
              </Animated.View>
            )}

            {step === 2 && (
              <Animated.View key="step2" entering={FadeInRight} exiting={FadeOutLeft}>
                <Text style={styles.stepTitle}>{t.email}</Text>
                <View style={styles.inputWrapper}>
                  <View style={styles.field}>
                    <Mail size={18} color="#8b949e" style={styles.fieldIcon} />
                    <TextInput 
                      style={styles.input} 
                      placeholder="name@example.com" 
                      placeholderTextColor="#484f58" 
                      value={form.email} 
                      onChangeText={v => setForm({...form, email: v})} 
                      keyboardType="email-address"
                      autoCapitalize="none" 
                    />
                  </View>
                </View>
                <TouchableOpacity style={styles.nextBtn} onPress={nextStep}>
                  <Text style={styles.nextBtnText}>{t.next}</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {step === 3 && (
              <Animated.View key="step3" entering={FadeInRight} exiting={FadeOutLeft}>
                <Text style={styles.stepTitle}>{t.password}</Text>
                <View style={styles.inputWrapper}>
                  <View style={styles.field}>
                    <Lock size={18} color="#8b949e" style={styles.fieldIcon} />
                    <TextInput 
                      style={styles.input} 
                      placeholder="Пароль" 
                      placeholderTextColor="#484f58" 
                      secureTextEntry={!showPass} 
                      value={form.password} 
                      onChangeText={v => setForm({...form, password: v})} 
                    />
                    <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                      {showPass ? <EyeOff size={18} color="#8b949e" /> : <Eye size={18} color="#8b949e" />}
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity style={[styles.nextBtn, { backgroundColor: '#238636' }]} onPress={handleRegister} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextBtnText}>{t.join}</Text>}
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#161b22', borderRadius: 12, padding: 28, borderWidth: 1, borderColor: '#30363d' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 24 },
  iconBtn: { padding: 4 },
  progressTrack: { flex: 1, height: 4, backgroundColor: '#0d1117', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#238636' },
  stepCounter: { color: '#8b949e', fontSize: 12, fontWeight: '700' },
  errorBanner: { backgroundColor: 'rgba(248, 81, 73, 0.15)', borderWidth: 1, borderColor: '#f85149', padding: 10, borderRadius: 6, marginBottom: 16 },
  errorBannerText: { color: '#f85149', fontSize: 13, textAlign: 'center' },
  contentArea: { minHeight: 260 },
  stepTitle: { color: '#f0f6fc', fontSize: 22, fontWeight: '700', marginBottom: 24 },
  langGrid: { gap: 12, marginBottom: 32 },
  langBtn: { backgroundColor: '#21262d', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#30363d' },
  langBtnActive: { borderColor: '#5353ff', backgroundColor: 'rgba(83, 83, 255, 0.1)' },
  langText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  inputWrapper: { marginBottom: 24 },
  field: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d1117', borderRadius: 6, borderWidth: 1, borderColor: '#30363d', height: 44, paddingHorizontal: 12 },
  fieldIcon: { marginRight: 10 },
  input: { flex: 1, color: '#f0f6fc', fontSize: 14, height: '100%' },
  inputError: { borderColor: '#f85149' },
  nextBtn: { backgroundColor: '#21262d', height: 44, borderRadius: 6, borderWidth: 1, borderColor: '#30363d', justifyContent: 'center', alignItems: 'center' },
  nextBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 }
});