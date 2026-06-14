import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useStore } from '../../../core/store/useStore';
import { theme } from '../../../core/theme';

export default function ChaosInput() {
  const [text, setText] = useState('');
  const { ingestText, isIngesting, ingestStatus, ingestMessage, clearIngestStatus } = useStore();

  const handleSync = async () => {
    if (!text.trim() || text.trim().length < 5) return;
    clearIngestStatus();
    await ingestText(text.trim(), 'DIRECT_TEXT');
    setText('');
  };

  const isQueued = ingestStatus === 'queued';
  const isError = ingestStatus === 'error';

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Paste anything — notice, WhatsApp message, typed note</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. DSA assignment due Friday 11:59 PM, placement for Google opens Monday..."
        placeholderTextColor={theme.colors.outlineVariant}
        multiline
        value={text}
        onChangeText={setText}
        textAlignVertical="top"
      />
      
      <TouchableOpacity onPress={handleSync} disabled={isIngesting || isQueued || text.trim().length < 5} activeOpacity={0.8}
        style={[
          styles.button,
          isQueued && styles.buttonQueued,
          isError && styles.buttonError,
          (!text.trim() || text.trim().length < 5) && !isQueued && styles.buttonDisabled
        ]}>
        {isIngesting
          ? <ActivityIndicator size="small" color="#ffffff" />
          : <MaterialIcons name={isQueued ? "check-circle" : "sync"} size={20} color={isQueued ? "#86efac" : "#ffffff"} />}
        <Text style={[styles.buttonText, isQueued && styles.buttonTextQueued]}>
          {isIngesting ? 'Sending to AI...' : isQueued ? 'Queued for AI' : 'Sync Typed Text'}
        </Text>
      </TouchableOpacity>

      {ingestMessage ? (
        <View style={[styles.banner, isError ? styles.bannerError : null]}>
          <Text style={[styles.bannerText, isError && styles.bannerTextError]}>{ingestMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: theme.spacing.md, marginVertical: theme.spacing.sm, gap: theme.spacing.sm },
  label: { ...theme.typography.labelMd, color: theme.colors.onSurfaceVariant, textTransform: 'uppercase' },
  input: {
    backgroundColor: theme.colors.surfaceContainerLow,
    color: theme.colors.onSurface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.typography.bodyMd,
    minHeight: 100,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonQueued: { backgroundColor: '#166534' },
  buttonError: { backgroundColor: theme.colors.error },
  buttonText: { color: '#ffffff', ...theme.typography.labelMd, fontSize: 14 },
  buttonTextQueued: { color: '#86efac' },
  banner: { borderRadius: theme.borderRadius.md, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: theme.colors.surfaceContainerHigh, borderLeftWidth: 3, borderLeftColor: theme.colors.primary },
  bannerError: { backgroundColor: '#ffdad6', borderLeftColor: theme.colors.error },
  bannerText: { ...theme.typography.bodyMd, color: theme.colors.onSurface },
  bannerTextError: { color: '#93000a' },
});
