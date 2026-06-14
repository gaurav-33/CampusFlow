import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, RefreshControl, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useStore } from '../../../src/core/store/useStore';
import { theme } from '../../../src/core/theme';
import ChaosInput from '../../../src/features/ingestion/components/ChaosInput';
import EventCard from '../../../src/components/EventCard';

function EmptyEvents() {
  return (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="event-busy" size={48} color={theme.colors.outlineVariant} style={{ marginBottom: 12 }} />
      <Text style={styles.emptyTitle}>No Events Yet</Text>
      <Text style={styles.emptyText}>
        Head to settings to upload your timetable, or sync from your clipboard to extract exams, assignments, and deadlines automatically.
      </Text>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { profile, events, healthScore, briefing, lastFetched, isLoading, studentName, fetchDashboard } = useStore();

  useEffect(() => { fetchDashboard().catch(console.warn); }, []);
  const onRefresh = useCallback(() => { fetchDashboard().catch(console.warn); }, [fetchDashboard]);

  // Extract priority events first
  const priorityEvents = events.filter(e => e.urgency === 'critical' || e.urgency === 'high').slice(0, 3);
  const priorityIds = new Set(priorityEvents.map(e => e.eventId));

  // The rest for the deadlines table
  const upcomingEvents = events.filter(e => !priorityIds.has(e.eventId)).slice(0, 5);

  return (
    <View style={styles.root}>


      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={theme.colors.primary} />}>

        <View style={styles.content}>
          {/* Greeting */}
          <View style={styles.greetingSection}>
            <Text style={styles.greeting}>Hey, {studentName || profile?.name || 'Student'}</Text>
          </View>

          {/* AI Morning Briefing */}
          {briefing && briefing.briefingText && (
            <View style={styles.briefingCard}>
              <View style={styles.briefingHeader}>
                <MaterialIcons name="auto-awesome" size={16} color={theme.colors.primary} />
                <Text style={styles.briefingTitle}>AI MORNING BRIEFING</Text>
              </View>
              <Text style={styles.briefingText}>{briefing.briefingText}</Text>
            </View>
          )}

          {/* Academic Status Section */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardLabel}>ACADEMIC HEALTH SCORE</Text>
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreValue}>{healthScore?.score ?? profile?.healthScore ?? 100}</Text>
                  <View style={styles.trendBadge}>
                    <MaterialIcons name="trending-up" size={16} color={theme.colors.primary} />
                    <Text style={styles.trendText}>Healthy</Text>
                  </View>
                </View>
              </View>
              <View style={styles.lastUpdate}>
                <Text style={styles.lastUpdateLabel}>Last Update</Text>
                <Text style={styles.lastUpdateValue}>
                  {lastFetched ? new Date(lastFetched).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                </Text>
              </View>
            </View>
          </View>


          {/* Priority Actions */}
          <View style={styles.card}>
            <View style={[styles.cardTitleRow, { justifyContent: 'space-between' }]}>
              <Text style={styles.cardHeadline}>Priority Actions</Text>
              <TouchableOpacity><Text style={styles.viewAllText}>View All</Text></TouchableOpacity>
            </View>
            <View style={styles.priorityList}>
              {priorityEvents.length > 0 ? priorityEvents.map(ev => (
                <EventCard key={ev.eventId} event={ev} compact />
              )) : (
                <Text style={styles.bodyText}>No priority actions right now.</Text>
              )}
            </View>
          </View>

          {/* Sync Input Card */}
          <View style={[styles.cardTitleRow, { paddingHorizontal: 4, marginTop: 16 }]}>
            <Text style={styles.cardHeadline}>Sync Your Clipboard</Text>
          </View>
          <ChaosInput />

          {/* Upcoming Deadlines (Table Sim) */}
          <View style={styles.tableCard}>
            <View style={styles.tableHeader}>
              <Text style={styles.cardHeadline}>Upcoming Deadlines</Text>
            </View>
            <View style={styles.tableContainer}>
              {upcomingEvents.length === 0 ? <EmptyEvents /> : upcomingEvents.map((ev, index) => (
                <TouchableOpacity key={ev.eventId} style={[styles.tableRow, index !== upcomingEvents.length - 1 && styles.tableRowBorder]} onPress={() => router.push(`/event/${encodeURIComponent(ev.eventId)}`)}>
                  <View style={styles.tableColMain}>
                    <Text style={styles.tableItemTitle} numberOfLines={1}>{ev.title}</Text>
                    <Text style={styles.tableItemType}>{ev.type.toUpperCase()}</Text>
                  </View>
                  <View style={styles.tableColSide}>
                    <Text style={styles.tableItemDate}>{ev.timestamp ? new Date(ev.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'TBA'}</Text>
                    <View style={styles.tableStatusBadge}>
                      <Text style={styles.tableStatusText}>PENDING</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surfaceContainerLowest },
  scrollView: { flex: 1 },
  topAppBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: theme.spacing.md, height: 64,
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderBottomWidth: 1, borderBottomColor: theme.colors.outlineVariant,
  },
  topAppLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIcon: { padding: 4 },
  appTitle: { ...theme.typography.headlineMd, color: theme.colors.primary },
  avatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.outlineVariant },
  content: { padding: theme.spacing.md },
  
  greetingSection: { marginBottom: theme.spacing.lg },
  greeting: { ...theme.typography.headlineLg, color: theme.colors.onSurface },
  
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderWidth: 1, borderColor: theme.colors.surfaceContainerHigh,
    marginBottom: theme.spacing.md,
    shadowColor: '#004ac6', shadowOpacity: 0.04, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 4,
    overflow: 'hidden',
  },
  briefingCard: {
    backgroundColor: '#eff4ff', // Light primary tint
    borderRadius: 24,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: '#d1e0ff',
    shadowColor: '#004ac6', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3,
  },
  briefingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  briefingTitle: {
    ...theme.typography.labelMd,
    color: theme.colors.primary,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  briefingText: {
    ...theme.typography.bodyLg,
    color: '#111c2d',
    lineHeight: 24,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', padding: theme.spacing.md },
  cardLabel: { ...theme.typography.labelMd, color: theme.colors.onSurfaceVariant, marginBottom: theme.spacing.xs },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm },
  scoreValue: { ...theme.typography.displayLg, color: theme.colors.onSurface },
  trendBadge: { flexDirection: 'row', alignItems: 'center' },
  trendText: { ...theme.typography.labelMd, color: theme.colors.primary, marginLeft: 4 },
  lastUpdate: { alignItems: 'flex-end', justifyContent: 'flex-end', paddingBottom: 4 },
  lastUpdateLabel: { ...theme.typography.labelMd, color: theme.colors.onSurfaceVariant },
  lastUpdateValue: { ...theme.typography.bodyMd, color: theme.colors.onSurface },

  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md, paddingBottom: 8 },
  cardHeadline: { ...theme.typography.headlineMd, color: theme.colors.onSurface },
  cardBody: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md },
  bodyText: { ...theme.typography.bodyLg, color: theme.colors.onSurfaceVariant },

  viewAllText: { ...theme.typography.labelMd, color: theme.colors.primary },
  priorityList: { paddingHorizontal: theme.spacing.xs, paddingBottom: theme.spacing.xs },

  tableCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderWidth: 1, borderColor: theme.colors.surfaceContainerHigh,
    marginTop: theme.spacing.md,
    shadowColor: '#004ac6', shadowOpacity: 0.04, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 4,
    overflow: 'hidden',
  },
  tableHeader: { padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.outlineVariant },
  tableContainer: { backgroundColor: '#ffffff' },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', padding: theme.spacing.md },
  tableRowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.outlineVariant },
  tableColMain: { flex: 2, justifyContent: 'center' },
  tableColSide: { flex: 1, alignItems: 'flex-end', justifyContent: 'center', gap: 4 },
  tableItemTitle: { ...theme.typography.bodyMd, color: theme.colors.onSurface },
  tableItemType: { ...theme.typography.labelMd, color: theme.colors.onSurfaceVariant, fontWeight: '400' },
  tableItemDate: { ...theme.typography.bodyMd, color: theme.colors.onSurfaceVariant },
  tableStatusBadge: { backgroundColor: theme.colors.surfaceContainerHigh, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  tableStatusText: { ...theme.typography.labelMd, color: theme.colors.onSurfaceVariant, fontSize: 10 },

  emptyContainer: { alignItems: 'center', padding: theme.spacing.xl, backgroundColor: theme.colors.surfaceContainerLowest },
  emptyTitle: { ...theme.typography.headlineMd, color: theme.colors.onSurface, marginBottom: theme.spacing.sm },
  emptyText: { ...theme.typography.bodyMd, color: theme.colors.onSurfaceVariant, textAlign: 'center' },
});
