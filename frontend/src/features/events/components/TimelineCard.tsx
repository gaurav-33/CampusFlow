import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { CampusEvent } from '../../../core/store/useStore';
import { MaterialIcons } from '@expo/vector-icons';

interface Props {
  event: CampusEvent;
  onPress?: () => void;
}

const URGENCY_COLORS: Record<string, string> = {
  critical: '#ba1a1a',
  medium: '#bc4800',
  low: '#505f76',
};

const TYPE_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  exam: 'edit-document', assignment: 'assignment', lab: 'science', lecture: 'menu-book', meeting: 'handshake', other: 'push-pin',
};

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  pending: { color: '#bc4800', label: 'Pending' },
  completed: { color: '#004ac6', label: 'Done' },
  missed: { color: '#ba1a1a', label: 'Missed' },
};

function formatDate(iso: string | null): string {
  if (!iso) return 'No date';
  const date = new Date(iso);
  const diffHours = (date.getTime() - Date.now()) / 3600000;
  if (diffHours < 0) return 'Past due';
  if (diffHours < 24) return `In ${Math.round(diffHours)}h`;
  if (diffHours < 48) return 'Tomorrow';
  return date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function TimelineCard({ event, onPress }: Props) {
  const urgencyColor = URGENCY_COLORS[event.urgency] ?? '#64748b';
  const icon = TYPE_ICONS[event.type] ?? 'push-pin';
  const status = STATUS_STYLES[event.status] ?? STATUS_STYLES.pending;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={[styles.card, { borderLeftColor: urgencyColor }]}>
      <View style={styles.iconContainer}>
        <MaterialIcons name={icon} size={22} color="#111c2d" />
        <View style={[styles.urgencyDot, { backgroundColor: urgencyColor }]} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
        <View style={styles.meta}>
          {event.courseCode && <Text style={styles.metaTag}>{event.courseCode}</Text>}
          {event.venue && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <MaterialIcons name="location-on" size={14} color="#434655" />
              <Text style={styles.metaVenue}>{event.venue}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.right}>
        <Text style={[styles.timeText, event.urgency === 'critical' && { color: '#ba1a1a' }]}>
          {formatDate(event.timestamp)}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: status.color + '22' }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#ffffff', borderRadius: 8, borderWidth: 1, borderColor: '#c3c6d7', borderLeftWidth: 4, flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, marginHorizontal: 16, marginVertical: 5, gap: 12 },
  iconContainer: { alignItems: 'center', gap: 4 },
  urgencyDot: { width: 6, height: 6, borderRadius: 3 },
  content: { flex: 1, gap: 4 },
  title: { color: '#111c2d', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  meta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaTag: { color: '#434655', fontSize: 11, fontWeight: '500', backgroundColor: '#f0f3ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  metaVenue: { color: '#434655', fontSize: 11 },
  right: { alignItems: 'flex-end', gap: 6, minWidth: 60 },
  timeText: { color: '#434655', fontSize: 11, fontWeight: '600', textAlign: 'right' },
  statusPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },
});
