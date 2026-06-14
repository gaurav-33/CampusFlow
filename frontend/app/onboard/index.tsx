import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '../../src/core/theme';

const { width } = Dimensions.get('window');

const ONBOARDING_STEPS = [
  {
    title: 'Welcome to CampusFlow',
    subtitle: 'Your AI-powered academic command center.',
    icon: 'bolt' as const,
    color: theme.colors.primary,
  },
  {
    title: 'Sync Your Timetable',
    subtitle: 'Paste your semester schedule, syllabi, or WhatsApp notices. Our AI extracts events and deadlines automatically.',
    icon: 'auto-fix-high' as const,
    color: '#2563eb',
  },
  {
    title: 'Stay Ahead of Deadlines',
    subtitle: 'Get intelligent nudges and morning briefings so you never miss an assignment or exam again.',
    icon: 'auto-awesome' as const,
    color: '#f59e0b', // Amber
  }
];

export default function OnboardingIndexScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < ONBOARDING_STEPS.length - 1) {
      setStep(prev => prev + 1);
    } else {
      router.push('/onboard/push');
    }
  };

  const currentStep = ONBOARDING_STEPS[step];

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.container}>
        
        <View style={styles.progressContainer}>
          {ONBOARDING_STEPS.map((_, idx) => (
            <View 
              key={idx} 
              style={[
                styles.progressDot, 
                idx === step && styles.progressDotActive
              ]} 
            />
          ))}
        </View>

        <View style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: currentStep.color + '20' }]}>
            <MaterialIcons name={currentStep.icon} size={80} color={currentStep.color} />
          </View>
          
          <Text style={styles.title}>{currentStep.title}</Text>
          <Text style={styles.subtitle}>{currentStep.subtitle}</Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.primaryBtn} 
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>
              {step === ONBOARDING_STEPS.length - 1 ? 'Get Started' : 'Next'}
            </Text>
            <MaterialIcons name="arrow-forward" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9f9ff' },
  container: { flex: 1, padding: 24, justifyContent: 'space-between' },
  
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.outlineVariant,
  },
  progressDotActive: {
    width: 24,
    backgroundColor: theme.colors.primary,
  },

  content: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  title: {
    ...theme.typography.displayLg,
    fontSize: 32,
    color: '#111c2d',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  subtitle: {
    ...theme.typography.bodyLg,
    color: '#434655',
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 16,
  },

  footer: {
    paddingBottom: 24,
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: theme.colors.primary, 
    shadowOpacity: 0.3, 
    shadowRadius: 12, 
    shadowOffset: { width: 0, height: 6 }, 
    elevation: 6,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
});
