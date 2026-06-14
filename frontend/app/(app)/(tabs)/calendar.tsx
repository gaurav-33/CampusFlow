import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useStore } from '../../../src/core/store/useStore';
import { theme } from '../../../src/core/theme';
import { useRouter } from 'expo-router';
import EventCard from '../../../src/components/EventCard';

export default function CalendarScreen() {
  const router = useRouter();
  const { events, completedEvents, isLoading, fetchDashboard } = useStore();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');

  const onRefresh = useCallback(() => { fetchDashboard().catch(console.warn); }, [fetchDashboard]);

  // Group events by date
  const groupedEvents: Record<string, any[]> = {};
  events.forEach((ev: any) => {
    const dateStr = ev.timestamp ? new Date(ev.timestamp).toDateString() : 'TBA';
    if (!groupedEvents[dateStr]) groupedEvents[dateStr] = [];
    groupedEvents[dateStr].push(ev);
  });

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return theme.colors.error;
      case 'high': return '#f59e0b';
      case 'medium': return theme.colors.primary;
      default: return theme.colors.outlineVariant;
    }
  };

  return (
    <View style={styles.root}>
      {/* Segmented Control */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'upcoming' && styles.tabButtonActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>Upcoming</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>History</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {activeTab === 'upcoming' ? (
          Object.keys(groupedEvents).length > 0 ? (
            Object.keys(groupedEvents).map(dateStr => (
              <View key={dateStr} style={styles.dateGroup}>
                <View style={styles.dateHeaderRow}>
                  <View style={styles.dateLine} />
                  <Text style={styles.dateHeaderText}>
                    {dateStr === 'TBA' ? 'To Be Announced' : new Date(dateStr).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                  </Text>
                  <View style={styles.dateLine} />
                </View>

                {groupedEvents[dateStr].map(ev => (
                  <EventCard key={ev.eventId} event={ev} />
                ))}
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="event-available" size={64} color={theme.colors.outlineVariant} style={{ marginBottom: 16 }} />
              <Text style={styles.emptyTitle}>Your Calendar is Clear</Text>
              <Text style={styles.emptyText}>
                Upload your semester timetable or sync notices to populate your timeline.
              </Text>
            </View>
          )
        ) : (
          /* History Tab */
          completedEvents.length > 0 ? (
            <View style={styles.dateGroup}>
              {completedEvents.map(ev => (
                <EventCard key={ev.eventId} event={ev} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="history" size={64} color={theme.colors.outlineVariant} style={{ marginBottom: 16 }} />
              <Text style={styles.emptyTitle}>No History Yet</Text>
              <Text style={styles.emptyText}>
                Complete tasks to see your history log grow here.
              </Text>
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surfaceContainerLowest },
  
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    margin: theme.spacing.md,
    borderRadius: 24,
    padding: 6,
    shadowColor: '#004ac6', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
    borderWidth: 1, borderColor: theme.colors.surfaceContainerHigh,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 20,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  tabText: {
    ...theme.typography.labelMd,
    color: theme.colors.onSurfaceVariant,
    fontWeight: '600',
    fontSize: 14,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },

  scrollView: { flex: 1 },
  scrollContent: { padding: theme.spacing.md, paddingBottom: 100 },
  
  dateGroup: { marginBottom: theme.spacing.lg },
  dateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  dateHeaderText: {
    ...theme.typography.labelMd,
    color: theme.colors.primary,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 16,
    textTransform: 'uppercase',
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.outlineVariant,
  },
  
  emptyContainer: { alignItems: 'center', padding: theme.spacing.xl, marginTop: 40 },
  emptyTitle: { ...theme.typography.headlineMd, color: theme.colors.onSurface, marginBottom: theme.spacing.sm },
  emptyText: { ...theme.typography.bodyMd, color: theme.colors.onSurfaceVariant, textAlign: 'center', lineHeight: 22 },
});
