import { useEffect, useRef } from 'react';
import { AppState, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '../core/store/useStore';

const KEYWORDS = [
  'deadline', 'exam', 'submission', 'registration',
  'placement', 'fee', 'due', 'notice', 'assignment', 'hostel', 'alert'
];

export const useClipboardHook = () => {
  const { studentId, isAuthenticated, ingestText } = useStore();
  const lastText = useRef('');

  useEffect(() => {
    if (!isAuthenticated || !studentId) return;

    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState !== 'active') return;

      try {
        const hasString = await Clipboard.hasStringAsync();
        if (!hasString) return;

        const text = await Clipboard.getStringAsync();
        if (!text) return;

        // Only process if text changed + contains academic keywords
        const isNew = text !== lastText.current && text.trim().length > 20;
        const hasKeyword = KEYWORDS.some(k => text.toLowerCase().includes(k));

        if (!isNew || !hasKeyword) return;

        lastText.current = text;

        Alert.alert(
          'Academic Info Detected',
          'We noticed an academic notice on your clipboard. Sync it to CampusFlow?',
          [
            { text: 'Ignore', style: 'cancel' },
            {
              text: 'Sync Now',
              onPress: () => {
                ingestText(text, 'CLIPBOARD');
              }
            }
          ]
        );
      } catch (err) {
        console.warn('Clipboard read failed:', err);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [studentId, isAuthenticated, ingestText]);
};
