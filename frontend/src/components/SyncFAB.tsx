import React from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet, Alert, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '../core/store/useStore';
import { theme } from '../core/theme';

export default function SyncFAB() {
  const { ingestText, isIngesting, ingestStatus, clearIngestStatus } = useStore();

  const handleClipboardSync = async () => {
    try {
      const clipboardText = await Clipboard.getStringAsync();
      if (!clipboardText || clipboardText.trim().length < 5) {
        Alert.alert('Clipboard Empty', 'Please copy some academic text first.');
        return;
      }
      clearIngestStatus();
      await ingestText(clipboardText.trim(), 'CLIPBOARD');
    } catch (e) {
      Alert.alert('Permission Denied', 'Cannot access clipboard.');
    }
  };

  const isQueued = ingestStatus === 'queued';
  const isError = ingestStatus === 'error';

  return (
    <View style={styles.container} pointerEvents="box-none">
      <TouchableOpacity
        onPress={handleClipboardSync}
        disabled={isIngesting || isQueued}
        activeOpacity={0.8}
        style={[
          styles.fab,
          isQueued && styles.fabQueued,
          isError && styles.fabError
        ]}
      >
        {isIngesting ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <MaterialIcons 
            name={isQueued ? "check" : "document-scanner"} 
            size={28} 
            color="#ffffff" 
          />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 40,
    left: '50%',
    marginLeft: -32, // half of width to perfectly center
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100, // ensure it's above tabs
    elevation: 12,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 4,
    borderColor: '#ffffff', // creates a nice cutout effect against the tab bar
  },
  fabQueued: {
    backgroundColor: '#166534',
    shadowColor: '#166534',
  },
  fabError: {
    backgroundColor: theme.colors.error,
    shadowColor: theme.colors.error,
  },
});
