import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import client from '../../src/core/api/client';
import { useStore } from '../../src/core/store/useStore';
import { useRouter } from 'expo-router';

export default function UploadScreen() {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success'>('idle');
  const { fetchDashboard, skipOnboarding } = useStore();
  const router = useRouter();

  // Polling mechanism
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'processing') {
      interval = setInterval(async () => {
        try {
          const { data } = await client.get('/dashboard');
          if (data.upcomingEvents && data.upcomingEvents.length > 0) {
            setStatus('success');
            await fetchDashboard().catch(console.warn); // This updates the store and triggers layout routing to /(app)
          }
        } catch (err) {
          console.error('[Upload] Polling failed', err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      const fileSize = file.size || 0;

      if (fileSize > 10 * 1024 * 1024) {
        Alert.alert('File too large', 'Please upload a PDF smaller than 10MB.');
        return;
      }

      setStatus('uploading');

      // Determine file extension
      const mimeType = file.mimeType || 'application/pdf';

      // 1. Get Presigned URL
      const { data } = await client.post('/upload/presign', {
        contentType: mimeType,
        fileSizeBytes: fileSize
      });
      const { uploadUrl } = data;

      // 2. Upload to S3
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, file.uri, {
        httpMethod: 'PUT',
        headers: {
          'Content-Type': mimeType,
        },
      });

      if (uploadResult.status !== 200) {
        throw new Error('S3 upload failed');
      }

      // 3. Wait for Bedrock / SQS to process
      setStatus('processing');

    } catch (err: any) {
      console.error(err);
      setStatus('idle');
      Alert.alert('Upload Failed', err.message || 'Could not upload timetable.');
    }
  };

  const handleSkip = () => {
    try {
      skipOnboarding();
      router.replace('/(app)');
    } catch (err) {
      console.error('Failed to skip onboarding', err);
      router.replace('/(app)');
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialIcons 
            name={status === 'processing' ? "memory" : "calendar-month"} 
            size={64} 
            color="#004ac6" 
          />
        </View>
        <Text style={styles.title}>
          {status === 'processing' ? 'Organizing your semester...' : 'Upload your timetable'}
        </Text>
        <Text style={styles.subtitle}>
          {status === 'processing' 
            ? 'Our AI is extracting your classes, exams, and deadlines. This takes about 10 seconds.'
            : 'Select your semester timetable PDF. We will automatically create your personalized calendar.'}
        </Text>

        {status === 'idle' && (
          <TouchableOpacity onPress={handleUpload} style={styles.uploadBtn} activeOpacity={0.8}>
            <MaterialIcons name="upload-file" size={24} color="#fff" />
            <Text style={styles.uploadBtnText}>Upload Timetable (PDF or Image)</Text>
          </TouchableOpacity>
        )}

        {(status === 'uploading' || status === 'processing') && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#004ac6" />
            <Text style={styles.loadingText}>
              {status === 'uploading' ? 'Uploading securely...' : 'Processing with Llama 3...'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {status === 'idle' && (
          <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
            <Text style={styles.skipBtnText}>Skip for now</Text>
          </TouchableOpacity>
        )}
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
  uploadBtn: {
    backgroundColor: '#004ac6', borderRadius: 14, paddingVertical: 18, paddingHorizontal: 32,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12,
    shadowColor: '#004ac6', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4
  },
  uploadBtnText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  loadingBox: { alignItems: 'center', gap: 16, marginTop: 10 },
  loadingText: { color: '#434655', fontSize: 15, fontWeight: '500' },
  footer: { padding: 32, paddingBottom: Platform.OS === 'ios' ? 48 : 32, alignItems: 'center' },
  skipBtn: { paddingVertical: 12, paddingHorizontal: 24 },
  skipBtnText: { color: '#737686', fontSize: 15, fontWeight: '500' }
});
