import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useStore } from '../../src/core/store/useStore';

export default function PushScreen() {
  const { updateProfile } = useStore();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const requestPermission = async () => {
    setIsLoading(true);
    try {
      if (!Device.isDevice) {
        Alert.alert('Emulator Detected', 'Push Notifications require a physical device. Proceeding without push token.');
        await updateProfile({ expoPushToken: 'skipped' });
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert('Permission Denied', 'You can enable notifications later in Settings.');
        await updateProfile({ expoPushToken: 'skipped' });
        return;
      }

      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

      if (!projectId) {
        Alert.alert('EAS Setup Missing', 'Run `eas init` to link your project. Saving token locally for now.');
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;
      
      await updateProfile({ expoPushToken: token });
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.message || 'An error occurred.');
      await updateProfile({ expoPushToken: 'skipped' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="notifications-active" size={64} color="#004ac6" />
        </View>
        <Text style={styles.title}>Stay in the loop</Text>
        <Text style={styles.subtitle}>
          CampusFlow needs notification access to send you timely nudges about deadlines, exams, and important campus events.
        </Text>

        <View style={styles.featureBox}>
          <View style={styles.featureRow}>
            <MaterialIcons name="check-circle" size={20} color="#2563eb" />
            <Text style={styles.featureText}>Never miss an assignment deadline</Text>
          </View>
          <View style={styles.featureRow}>
            <MaterialIcons name="check-circle" size={20} color="#2563eb" />
            <Text style={styles.featureText}>Morning briefings right at 7:30 AM</Text>
          </View>
          <View style={styles.featureRow}>
            <MaterialIcons name="check-circle" size={20} color="#2563eb" />
            <Text style={styles.featureText}>Urgent alerts for schedule changes</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          onPress={requestPermission} 
          disabled={isLoading} 
          style={styles.primaryBtn}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Enable Notifications</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => updateProfile({ expoPushToken: 'skipped' })} 
          style={styles.skipBtn}
        >
          <Text style={styles.skipBtnText}>I'll do this later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9f9ff', justifyContent: 'space-between' },
  content: { flex: 1, padding: 32, justifyContent: 'center', alignItems: 'center' },
  iconContainer: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: '#e7eeff',
    justifyContent: 'center', alignItems: 'center', marginBottom: 32
  },
  title: { fontSize: 28, fontWeight: '800', color: '#111c2d', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#434655', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  featureBox: {
    width: '100%', backgroundColor: '#ffffff', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: '#dee8ff', gap: 16
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureText: { fontSize: 15, color: '#111c2d', fontWeight: '500' },
  footer: { padding: 32, paddingBottom: Platform.OS === 'ios' ? 48 : 32 },
  primaryBtn: {
    backgroundColor: '#004ac6', borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', shadowColor: '#004ac6', shadowOpacity: 0.2,
    shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4
  },
  primaryBtnText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  skipBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  skipBtnText: { color: '#737686', fontSize: 15, fontWeight: '500' }
});
