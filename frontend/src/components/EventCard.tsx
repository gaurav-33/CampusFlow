import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../core/theme';
import { CampusEvent, useStore } from '../core/store/useStore';
import { useRouter } from 'expo-router';

interface EventCardProps {
  event: CampusEvent;
  compact?: boolean; // For dashboard priority actions
}

export default function EventCard({ event, compact = false }: EventCardProps) {
  const router = useRouter();
  const { markEventDone } = useStore();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleComplete = () => {
    // 1. Trigger scale animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 100,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1.1,
        duration: 100,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0, // shrink to 0 to disappear
        duration: 150,
        useNativeDriver: true,
      })
    ]).start(() => {
      // 2. Call the optimistic store action after animation
      markEventDone(event.eventId);
    });
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return theme.colors.error;
      case 'high': return '#f59e0b';
      case 'medium': return theme.colors.primary;
      default: return theme.colors.outlineVariant;
    }
  };

  const formattedTime = event.timestamp 
    ? new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    : 'TBA';
    
  const formattedDate = event.timestamp
    ? new Date(event.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })
    : '';

  if (compact) {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity 
          style={styles.compactCard} 
          onPress={() => router.push(`/event/${encodeURIComponent(event.eventId)}`)}
          activeOpacity={0.8}
        >
          <View style={[styles.urgencyDot, { backgroundColor: getUrgencyColor(event.urgency) }]} />
          <View style={styles.content}>
            <Text style={[styles.urgencyLabel, { color: getUrgencyColor(event.urgency) }]}>
              {event.urgency.toUpperCase()}
            </Text>
            <Text style={styles.title} numberOfLines={1}>{event.title}</Text>
            <Text style={styles.meta}>Due {formattedDate}</Text>
          </View>
          {event.status !== 'completed' && (
            <TouchableOpacity 
              style={styles.checkButton} 
              onPress={handleComplete}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <MaterialIcons name="check" size={18} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Full calendar view
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity 
        style={styles.fullCard}
        onPress={() => router.push(`/event/${encodeURIComponent(event.eventId)}`)}
        activeOpacity={0.8}
      >
        <View style={[styles.urgencyStrip, { backgroundColor: getUrgencyColor(event.urgency) }]} />
        <View style={styles.fullContent}>
          <View style={styles.fullHeader}>
            <Text style={styles.timeLabel}>{formattedTime}</Text>
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{event.type.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.fullTitle} numberOfLines={2}>{event.title}</Text>
        </View>
        {event.status !== 'completed' && (
          <TouchableOpacity 
            style={styles.checkButtonLarge} 
            onPress={handleComplete}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <MaterialIcons name="check" size={24} color="#10b981" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Compact (Dashboard Priority)
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginVertical: 4,
    marginHorizontal: 8,
    shadowColor: '#004ac6', shadowOpacity: 0.03, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 1,
  },
  urgencyDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4, alignSelf: 'flex-start' },
  content: { flex: 1 },
  urgencyLabel: { ...theme.typography.labelMd, marginBottom: 2 },
  title: { ...theme.typography.bodyMd, color: theme.colors.onSurface, fontWeight: '600' },
  meta: { ...theme.typography.labelMd, color: theme.colors.onSurfaceVariant, fontWeight: '400' },
  checkButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.primary + '50',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceContainerLowest,
  },

  // Full (Calendar Timeline)
  fullCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.surfaceContainerHigh,
    marginBottom: theme.spacing.sm,
    shadowColor: '#004ac6', shadowOpacity: 0.04, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2,
    overflow: 'hidden',
  },
  urgencyStrip: { width: 6, height: '100%' },
  fullContent: { flex: 1, padding: theme.spacing.md },
  fullHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  timeLabel: { ...theme.typography.labelMd, color: theme.colors.primary, fontWeight: '600' },
  typeBadge: { backgroundColor: theme.colors.surfaceContainerHigh, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  typeText: { ...theme.typography.labelMd, color: theme.colors.onSurfaceVariant, fontSize: 10 },
  fullTitle: { ...theme.typography.bodyLg, color: theme.colors.onSurface, fontWeight: '500' },
  checkButtonLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#10b98150', // emerald green slightly transparent
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    backgroundColor: theme.colors.surfaceContainerLowest,
  },
});
