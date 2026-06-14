import React, { useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../src/core/store/useStore';
import { theme } from '../src/core/theme';

type Tab = 'login' | 'register';

export default function LoginScreen() {
  const [tab, setTab] = useState<Tab>('login');
  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const { login, register, isLoading } = useStore();

  const handleSubmit = async () => {
    if (!studentId.trim() || !password.trim()) {
      Alert.alert('Validation', 'Student ID and password are required.');
      return;
    }
    if (tab === 'register' && !name.trim()) {
      Alert.alert('Validation', 'Name is required for registration.');
      return;
    }
    try {
      if (tab === 'login') await login(studentId.trim(), password.trim());
      else await register(studentId.trim(), name.trim(), password.trim());
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong');
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Image 
                source={require('../assets/icon.png')} 
                style={{ width: 80, height: 80, borderRadius: 24 }} 
                resizeMode="cover" 
              />
            </View>
            <Text style={styles.title}>
              <Text style={{ color: theme.colors.onSurface }}>Campus</Text>
              <Text style={{ color: theme.colors.primary }}>Flow</Text>
            </Text>
            <Text style={styles.subtitle}>Your AI-powered academic command center</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.tabBar}>
              {(['login', 'register'] as Tab[]).map((t) => (
                <TouchableOpacity 
                  key={t} 
                  onPress={() => {
                    setTab(t);
                    setStudentId('');
                    setPassword('');
                    setName('');
                  }} 
                  style={[styles.tab, tab === t && styles.tabActive]}
                >
                  <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                    {t === 'login' ? 'Sign In' : 'Register'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <MaterialIcons name="badge" size={20} color={theme.colors.onSurfaceVariant} style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Student ID (e.g. CS2304080)" 
                  placeholderTextColor={theme.colors.outlineVariant} 
                  value={studentId} 
                  onChangeText={setStudentId} 
                  autoCapitalize="none" 
                />
              </View>

              {tab === 'register' && (
                <View style={styles.inputContainer}>
                  <MaterialIcons name="person" size={20} color={theme.colors.onSurfaceVariant} style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="Full Name" 
                    placeholderTextColor={theme.colors.outlineVariant} 
                    value={name} 
                    onChangeText={setName} 
                    autoCapitalize="words" 
                  />
                </View>
              )}

              <View style={styles.inputContainer}>
                <MaterialIcons name="lock" size={20} color={theme.colors.onSurfaceVariant} style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Password" 
                  placeholderTextColor={theme.colors.outlineVariant} 
                  value={password} 
                  onChangeText={setPassword} 
                  secureTextEntry 
                />
              </View>
            </View>

            <TouchableOpacity 
              onPress={handleSubmit} 
              disabled={isLoading} 
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]} 
              activeOpacity={0.85}
            >
              {isLoading ? <ActivityIndicator size="small" color={theme.colors.surface} /> : (
                <>
                  <Text style={styles.submitText}>{tab === 'login' ? 'Sign In' : 'Create Account'}</Text>
                  <MaterialIcons name="arrow-forward" size={20} color={theme.colors.surface} />
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>Paste any campus notice or WhatsApp message and let AI organize it for you.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  keyboardView: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 48 },
  
  header: { alignItems: 'center', marginBottom: 40 },
  iconContainer: { 
    width: 80, height: 80, borderRadius: 24, 
    alignItems: 'center', justifyContent: 'center', 
    marginBottom: 24,
    shadowColor: theme.colors.primary, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8,
    backgroundColor: '#fff' 
  },
  title: { ...theme.typography.displayLg, letterSpacing: -1, marginBottom: 8 },
  subtitle: { ...theme.typography.bodyLg, color: theme.colors.onSurfaceVariant, textAlign: 'center', paddingHorizontal: 20 },
  
  card: { 
    backgroundColor: theme.colors.surface, 
    borderRadius: 24, 
    padding: 24, 
    shadowColor: '#004ac6', shadowOpacity: 0.04, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 4,
    borderWidth: 1, borderColor: theme.colors.surfaceContainerHigh
  },
  
  tabBar: { flexDirection: 'row', backgroundColor: theme.colors.surfaceContainerLow, borderRadius: 16, padding: 6, marginBottom: 24 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  tabActive: { backgroundColor: theme.colors.surface, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabText: { ...theme.typography.labelMd, color: theme.colors.onSurfaceVariant, fontSize: 14 },
  tabTextActive: { color: theme.colors.primary, fontWeight: '700' },
  
  form: { gap: 16, marginBottom: 24 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderWidth: 1, borderColor: theme.colors.surfaceContainerHigh,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, ...theme.typography.bodyLg, color: theme.colors.onSurface, height: '100%' },
  
  submitButton: { 
    flexDirection: 'row', backgroundColor: theme.colors.primary, 
    borderRadius: 16, height: 56, 
    alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: theme.colors.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitText: { ...theme.typography.labelMd, color: theme.colors.surface, fontSize: 16 },
  
  footer: { ...theme.typography.bodyMd, color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 40, fontStyle: 'italic', paddingHorizontal: 20 },
});
