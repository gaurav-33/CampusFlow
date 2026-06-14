import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useStore } from '../../../src/core/store/useStore';
import { theme } from '../../../src/core/theme';
import { useRouter } from 'expo-router';

export default function NudgesScreen() {
  const router = useRouter();
  const { nudges, isLoading, fetchDashboard } = useStore();

  const onRefresh = useCallback(() => { fetchDashboard().catch(console.warn); }, [fetchDashboard]);

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return theme.colors.error;
      case 'high': return '#f59e0b'; // amber
      case 'medium': return theme.colors.primary;
      default: return theme.colors.outlineVariant;
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'warning';
      case 'high': return 'priority-high';
      case 'medium': return 'info-outline';
      default: return 'notifications-none';
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {nudges && nudges.length > 0 ? (
          nudges.map((nudge: any) => (
            <TouchableOpacity 
              key={nudge.nudgeId} 
              style={[styles.nudgeCard, !nudge.read && styles.nudgeCardUnread]}
              activeOpacity={0.8}
            >
              <View style={styles.nudgeHeader}>
                <View style={styles.urgencyBadge}>
                  <MaterialIcons 
                    name={getUrgencyIcon(nudge.urgency)} 
                    size={14} 
                    color={getUrgencyColor(nudge.urgency)} 
                  />
                  <Text style={[styles.urgencyText, { color: getUrgencyColor(nudge.urgency) }]}>
                    {nudge.urgency?.toUpperCase() || 'UPDATE'}
                  </Text>
                </View>
                <Text style={styles.timeText}>
                  {new Date(nudge.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              
              <Text style={styles.nudgeText}>{nudge.nudgeText}</Text>
              
              <View style={styles.eventRefContainer}>
                <MaterialIcons name="link" size={14} color={theme.colors.onSurfaceVariant} />
                <Text style={styles.eventRefText} numberOfLines={1}>{nudge.eventRef}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="auto-awesome" size={64} color={theme.colors.outlineVariant} style={{ marginBottom: 16 }} />
            <Text style={styles.emptyTitle}>You're all caught up!</Text>
            <Text style={styles.emptyText}>
              When CampusFlow's AI engine detects a critical deadline or suggests an optimization, it will appear here.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surfaceContainerLowest },
  
  scrollView: { flex: 1 },
  scrollContent: { padding: theme.spacing.md, paddingBottom: 100 },
  
  nudgeCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceContainerHigh,
    shadowColor: '#004ac6', shadowOpacity: 0.04, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  nudgeCardUnread: {
    backgroundColor: '#ffffff',
    borderColor: theme.colors.primary + '40',
    shadowOpacity: 0.08,
  },
  
  nudgeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyText: {
    ...theme.typography.labelMd,
    fontWeight: '700',
  },
  timeText: {
    ...theme.typography.labelMd,
    color: theme.colors.onSurfaceVariant,
  },
  
  nudgeText: {
    ...theme.typography.bodyLg,
    color: theme.colors.onSurface,
    lineHeight: 24,
    marginBottom: 12,
  },
  
  eventRefContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outlineVariant,
  },
  eventRefText: {
    ...theme.typography.bodyMd,
    color: theme.colors.onSurfaceVariant,
    flex: 1,
  },
  
  emptyContainer: { alignItems: 'center', padding: theme.spacing.xl, marginTop: 40 },
  emptyTitle: { ...theme.typography.headlineMd, color: theme.colors.onSurface, marginBottom: theme.spacing.sm },
  emptyText: { ...theme.typography.bodyMd, color: theme.colors.onSurfaceVariant, textAlign: 'center', lineHeight: 22 },
});
