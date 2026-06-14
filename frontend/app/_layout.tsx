import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { useStore } from '../src/core/store/useStore';
import { useClipboardHook } from '../src/hooks/useClipboardHook';
import { useShareIntent } from 'expo-share-intent';

export default function RootLayout() {
  const { isAuthenticated, profile, events, restoreSession, ingestText, hasSeenOnboarding } = useStore();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  useClipboardHook();
  const segments = useSegments() as string[];
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    restoreSession().finally(() => setIsReady(true));
  }, []);

  // Handle incoming OS Share Intents
  useEffect(() => {
    if (hasShareIntent && isAuthenticated) {
      const content = shareIntent.text || shareIntent.webUrl;
      if (content) {
        ingestText(content, 'SHARE_TARGET');
        resetShareIntent();
      }
    }
  }, [hasShareIntent, shareIntent, isAuthenticated]);

  useEffect(() => {
    if (!isReady) return;

    const currentSegment = segments[0] as string | undefined;
    const inAuthGroup = currentSegment === '(app)';
    const inOnboardGroup = currentSegment === 'onboard';

    if (!isAuthenticated) {
      if (!hasSeenOnboarding && currentSegment !== 'onboard') {
        router.replace('/onboard');
      } else if (hasSeenOnboarding && (inAuthGroup || inOnboardGroup)) {
        router.replace('/');
      }
    } else {
      // User is authenticated, wait for dashboard fetch to populate profile
      if (!profile && !events.length) return;
      
      const hasPushToken = profile?.expoPushToken && profile.expoPushToken !== 'ExponentPushToken[dummy]' && profile.expoPushToken !== 'ExponentPushToken[dummy-token-for-dev]';
      const hasEvents = events && events.length > 0;
      const hasOnboardedFlag = profile?.onboarded;

      const isFullyOnboarded = hasEvents || hasOnboardedFlag;

      // Note: we use /onboard/push and /onboard/upload after auth
      if (!hasPushToken && segments[1] !== 'push' && segments[0] !== '(app)') {
        router.replace('/onboard/push');
      } else if (hasPushToken && !isFullyOnboarded && segments[1] !== 'upload' && segments[0] !== '(app)') {
        router.replace('/onboard/upload');
      } else if (hasPushToken && isFullyOnboarded && !inAuthGroup) {
        router.replace('/(app)');
      }
    }
  }, [isAuthenticated, profile, events, segments, isReady, hasSeenOnboarding]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#004ac6" />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#ffffff' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboard/index" />
        <Stack.Screen name="onboard/push" />
        <Stack.Screen name="onboard/upload" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}
