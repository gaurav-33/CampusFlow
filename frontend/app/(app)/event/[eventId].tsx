import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import client from '../../../src/core/api/client';
import { theme } from '../../../src/core/theme';

interface EventDetail {
  eventId: string; title: string; timestamp: string | null;
  type: string; urgency: string; status: string;
  venue?: string; courseCode?: string; description?: string; rawText?: string; createdAt: string;
}

const URGENCY_COLORS: Record<string, string> = { critical: '#ba1a1a', high: '#d97706', medium: '#0284c7', low: '#475569' };
const TYPE_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = { 
  exam: 'assignment', 
  assignment: 'assignment-ind', 
  lab: 'science', 
  lecture: 'menu-book', 
  meeting: 'groups', 
  fee: 'account-balance-wallet',
  placement: 'work',
  other: 'event' 
};

function InfoRow({ icon, label, value, color }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string; color?: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.iconBox}>
        <MaterialIcons name={icon} size={20} color={color || theme.colors.primary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function EventDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!eventId) return;
    client.get(`/events/${encodeURIComponent(eventId)}`)
      .then(({ data }) => setEvent(data.event))
      .catch((err: any) => setError(err.response?.data?.error || 'Failed to load event'))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  if (error || !event) return (
    <View style={styles.centered}>
      <MaterialIcons name="error-outline" size={48} color={theme.colors.error} style={{ marginBottom: 16 }} />
      <Text style={styles.errorText}>{error || 'Event not found'}</Text>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtnError}>
        <Text style={styles.backBtnText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  const urgencyColor = URGENCY_COLORS[event.urgency] || theme.colors.primary;
  const iconName = TYPE_ICONS[event.type] || 'event';
  const formatDate = (iso: string | null) => iso ? new Date(iso).toLocaleString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No date set';

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={[styles.heroIconWrap, { backgroundColor: urgencyColor + '15' }]}>
            <MaterialIcons name={iconName} size={42} color={urgencyColor} />
          </View>
          <Text style={styles.heroTitle}>{event.title}</Text>
          
          <View style={[styles.badgeContainer, { backgroundColor: urgencyColor + '10', borderColor: urgencyColor + '30' }]}>
            <View style={[styles.badgeDot, { backgroundColor: urgencyColor }]} />
            <Text style={[styles.badgeText, { color: urgencyColor }]}>{event.urgency.toUpperCase()} PRIORITY</Text>
          </View>
        </View>

        <View style={styles.card}>
          <InfoRow icon="schedule" label="Date & Time" value={formatDate(event.timestamp)} />
          <InfoRow icon="category" label="Event Type" value={event.type.charAt(0).toUpperCase() + event.type.slice(1)} />
          
          {event.courseCode && <InfoRow icon="school" label="Course" value={event.courseCode} />}
          {event.venue && <InfoRow icon="place" label="Location" value={event.venue} />}
          
          <InfoRow 
            icon={event.status === 'completed' ? 'check-circle' : 'pending-actions'} 
            label="Status" 
            value={event.status.charAt(0).toUpperCase() + event.status.slice(1)} 
            color={event.status === 'completed' ? '#10b981' : theme.colors.onSurfaceVariant}
          />
        </View>

        {event.description && (
          <View style={styles.descCard}>
            <View style={styles.descHeader}>
              <MaterialIcons name="subject" size={20} color={theme.colors.onSurfaceVariant} />
              <Text style={styles.descTitle}>Description</Text>
            </View>
            <Text style={styles.descText}>{event.description}</Text>
          </View>
        )}
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background, paddingTop: Platform.OS === 'android' ? 40 : 0 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background, padding: 24 },
  errorText: { ...theme.typography.bodyLg, color: theme.colors.error, textAlign: 'center', marginBottom: 24, fontWeight: '500' },
  backBtnError: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.colors.surfaceContainerHigh },
  backBtnText: { ...theme.typography.labelMd, color: theme.colors.onSurface },
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  headerTitle: { ...theme.typography.headlineMd, fontSize: 18 },
  
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  
  heroCard: { backgroundColor: theme.colors.surface, borderRadius: 24, padding: 32, alignItems: 'center', shadowColor: '#004ac6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 24, elevation: 4, marginBottom: 20 },
  heroIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  heroTitle: { ...theme.typography.headlineMd, textAlign: 'center', color: theme.colors.onSurface, marginBottom: 16 },
  badgeContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  badgeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  badgeText: { ...theme.typography.labelMd, letterSpacing: 1 },
  
  card: { backgroundColor: theme.colors.surface, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 12, elevation: 3, marginBottom: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.surfaceContainerHigh },
  iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  infoContent: { flex: 1 },
  infoLabel: { ...theme.typography.labelMd, color: theme.colors.onSurfaceVariant, marginBottom: 2 },
  infoValue: { ...theme.typography.bodyMd, color: theme.colors.onSurface, fontWeight: '500' },
  
  descCard: { backgroundColor: theme.colors.surface, borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 12, elevation: 3 },
  descHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  descTitle: { ...theme.typography.headlineMd, fontSize: 16, color: theme.colors.onSurface, marginLeft: 8 },
  descText: { ...theme.typography.bodyLg, color: theme.colors.onSurfaceVariant, lineHeight: 26 },
});
