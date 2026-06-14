import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, TextInput, ScrollView, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useStore } from '../../../src/core/store/useStore';
import client from '../../../src/core/api/client';
import { useRouter } from 'expo-router';
import { theme } from '../../../src/core/theme';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
let Notifications: any = null;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    console.warn('Failed to load expo-notifications', e);
  }
}

export default function SettingsScreen() {
  const router = useRouter();
  const { logout, profile, studentName, fetchDashboard, updateProfileMeta, updateProfile } = useStore();
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(!!profile?.expoPushToken && profile?.expoPushToken !== 'skipped');

  const [college, setCollege] = useState('');
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');

  useEffect(() => {
    if (profile) {
      setCollege(profile.college || '');
      setBranch(profile.branch || '');
      setYear(profile.year || '');
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    await updateProfileMeta(college, branch, year);
    setIsSaving(false);
    setIsEditing(false);
    Alert.alert('Profile Saved', 'Your academic profile has been updated!');
  };

  const handleUploadTimetable = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const file = result.assets[0];
      const fileSize = file.size || 0;

      if (fileSize > 10 * 1024 * 1024) {
        Alert.alert('File too large', 'Please upload a file smaller than 10MB.');
        return;
      }

      setIsUploading(true);
      const mimeType = file.mimeType || 'application/pdf';

      const { data } = await client.post('/upload/presign', {
        contentType: mimeType,
        fileSizeBytes: fileSize
      });

      const uploadResult = await FileSystem.uploadAsync(data.uploadUrl, file.uri, {
        httpMethod: 'PUT',
        headers: { 'Content-Type': mimeType },
      });

      if (uploadResult.status !== 200) throw new Error('S3 upload failed');

      Alert.alert('Upload Successful', 'Your timetable is being processed by AI. It will appear on your dashboard shortly.');
      setIsUploading(false);
      setTimeout(() => fetchDashboard().catch(console.warn), 5000); // refresh after a delay to get new events
    } catch (err: any) {
      console.error(err);
      setIsUploading(false);
      Alert.alert('Upload Failed', err.message || 'Could not upload timetable.');
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.card}>
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(studentName || profile?.name || 'S')[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{studentName || profile?.name || 'Student'}</Text>
            <Text style={styles.subtitle}>Academic Profile</Text>
          </View>
          {!isEditing && (
            <TouchableOpacity onPress={() => setIsEditing(true)}>
              <MaterialIcons name="edit" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.divider} />

        {!isEditing ? (
          <View style={styles.staticProfile}>
            <Text style={styles.staticText}><Text style={{ fontWeight: '600' }}>College:</Text> {profile?.college || 'Not set'}</Text>
            <Text style={styles.staticText}><Text style={{ fontWeight: '600' }}>Branch/Major:</Text> {profile?.branch || 'Not set'}</Text>
            <Text style={styles.staticText}><Text style={{ fontWeight: '600' }}>Year:</Text> {profile?.year || 'Not set'}</Text>
          </View>
        ) : (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>College</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. IIT Delhi"
            placeholderTextColor="#8e919f"
            value={college}
            onChangeText={setCollege}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Branch/Major</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Computer Science"
            placeholderTextColor="#8e919f"
            value={branch}
            onChangeText={setBranch}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Year</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 3rd Year"
              placeholderTextColor="#8e919f"
              value={year}
              onChangeText={setYear}
            />
          </View>

          <TouchableOpacity 
            style={[styles.saveButton, (college === profile?.college && branch === profile?.branch && year === profile?.year) && styles.saveButtonDisabled]} 
            onPress={handleSaveProfile}
            disabled={isSaving || (college === profile?.college && branch === profile?.branch && year === profile?.year)}
          >
            {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Profile</Text>}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={() => {
              setCollege(profile?.college || '');
              setBranch(profile?.branch || '');
              setYear(profile?.year || '');
              setIsEditing(false);
            }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </>
      )}
      </View>

      <TouchableOpacity style={styles.actionButton} onPress={handleUploadTimetable} disabled={isUploading}>
        <View style={styles.iconBoxPrimary}>
          <MaterialIcons name="upload-file" size={24} color={theme.colors.primary} />
        </View>
        <Text style={styles.actionText}>Upload Timetable</Text>
        {isUploading ? (
          <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginLeft: 'auto' }} />
        ) : (
          <MaterialIcons name="chevron-right" size={24} color={theme.colors.outlineVariant} style={{ marginLeft: 'auto' }} />
        )}
      </TouchableOpacity>

      <View style={styles.actionButton}>
        <MaterialIcons name="notifications-none" size={24} color="#434655" />
        <Text style={styles.actionText}>Push Notifications</Text>
        <View style={{ marginLeft: 'auto' }}>
          <Switch 
            value={pushEnabled} 
            onValueChange={async (val) => {
              setPushEnabled(val);
              try {
                if (!val) {
                  await updateProfile({ expoPushToken: 'skipped' });
                  return;
                }

                // If turning ON:
                if (isExpoGo) {
                  Alert.alert('Expo Go Detected', 'Push Notifications require a Custom/Native Build. Bypassing token generation.');
                  await updateProfile({ expoPushToken: 'skipped' });
                  return;
                }
                if (!Device.isDevice) {
                  Alert.alert('Emulator Detected', 'Push Notifications require a physical device.');
                  setPushEnabled(false);
                  return;
                }
                if (!Notifications) throw new Error("Notifications module not loaded");

                const { status: existingStatus } = await Notifications.getPermissionsAsync();
                let finalStatus = existingStatus;
                if (existingStatus !== 'granted') {
                  const { status } = await Notifications.requestPermissionsAsync();
                  finalStatus = status;
                }

                if (finalStatus !== 'granted') {
                  Alert.alert('Permission Denied', 'Please enable notifications in your phone Settings.');
                  setPushEnabled(false);
                  await updateProfile({ expoPushToken: 'skipped' });
                  return;
                }

                const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
                const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
                await updateProfile({ expoPushToken: tokenData.data });
                
              } catch (e: any) {
                console.error(e);
                Alert.alert('Error', e.message || 'Failed to enable notifications');
                setPushEnabled(false);
              }
            }}
            trackColor={{ false: theme.colors.outlineVariant, true: theme.colors.primary }}
          />
        </View>
      </View>

      <TouchableOpacity style={styles.actionButton}>
        <MaterialIcons name="lock-outline" size={24} color="#434655" />
        <Text style={styles.actionText}>Privacy & Security</Text>
        <MaterialIcons name="chevron-right" size={24} color="#c3c6d7" style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionButton}>
        <MaterialIcons name="help-outline" size={24} color="#434655" />
        <Text style={styles.actionText}>Help & Support</Text>
        <MaterialIcons name="chevron-right" size={24} color="#c3c6d7" style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.actionButton, styles.logoutButton]} 
        onPress={async () => {
          await logout();
        }}
      >
        <MaterialIcons name="logout" size={24} color={theme.colors.error} />
        <Text style={[styles.actionText, { color: theme.colors.error }]}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9f9ff', padding: 16 },
  card: { backgroundColor: theme.colors.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: theme.colors.surfaceContainerHigh, marginBottom: 24, shadowColor: '#004ac6', shadowOpacity: 0.04, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 4 },
  profileSection: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#ffffff' },
  name: { fontSize: 22, fontWeight: '700', color: '#111c2d', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: theme.colors.onSurfaceVariant, marginTop: 4 },
  actionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 16, borderRadius: 20, marginBottom: 12, gap: 12, borderWidth: 1, borderColor: theme.colors.surfaceContainerHigh, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  actionText: { fontSize: 16, fontWeight: '600', color: '#111c2d' },
  logoutButton: { borderColor: theme.colors.error, backgroundColor: '#fffbfa', marginTop: 24 },
  iconBoxPrimary: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' },
  
  divider: { height: 1, backgroundColor: '#dee8ff', marginVertical: 16 },
  inputGroup: { marginBottom: 12 },
  inputLabel: { ...theme.typography.labelMd, color: '#434655', marginBottom: 4 },
  input: {
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: theme.colors.surfaceContainerHigh,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...theme.typography.bodyLg,
    color: '#111c2d',
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: theme.colors.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  saveButtonDisabled: {
    backgroundColor: '#dee8ff',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelButtonText: {
    ...theme.typography.labelMd,
    color: '#434655',
  },
  staticProfile: {
    paddingTop: 4,
  },
  staticText: {
    ...theme.typography.bodyMd,
    color: '#111c2d',
    marginBottom: 6,
  }
});
