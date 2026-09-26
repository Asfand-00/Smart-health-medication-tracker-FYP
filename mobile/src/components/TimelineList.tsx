import { StyleSheet, View } from 'react-native';

import { useTheme } from '../context/AccessibilityContext';
import { statusColor } from '../theme';
import type { TimelineEvent, TimelineEventType } from '../types/models';
import { formatDateTime } from '../utils/format';
import { AppText } from './ui/AppText';
import { Card, Pill } from './ui/Card';

const ICON: Record<TimelineEventType, string> = {
  adherence: '💊',
  vitals: '❤️',
  caregiver_note: '📝',
  cognitive_assessment: '🧠',
  behavioral_observation: '👁️',
  mood: '💖',
};

/** Port of components/ui/TimelineView.jsx. */
export function TimelineList({ events }: { events: TimelineEvent[] }) {
  const { colors } = useTheme();
  if (events.length === 0) {
    return (
      <AppText tone="faint" align="center">
        No recent timeline events found.
      </AppText>
    );
  }
  return (
    <View style={styles.list}>
      {events.map((ev, i) => (
        <View key={`${ev.type}-${ev.timestamp}-${i}`} style={styles.item}>
          <View style={styles.rail}>
            <AppText style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">
              {ICON[ev.type] ?? '•'}
            </AppText>
            {i < events.length - 1 && <View style={[styles.line, { backgroundColor: colors.border }]} />}
          </View>
          <Card style={styles.card}>
            <AppText weight="700">{ev.title}</AppText>
            <AppText variant="caption" tone="faint">
              {formatDateTime(ev.timestamp)}
            </AppText>
            {ev.message ? <AppText variant="caption" tone="muted">{ev.message}</AppText> : null}
            {ev.notes ? (
              <AppText variant="caption" tone="faint" style={styles.italic}>
                {ev.notes}
              </AppText>
            ) : null}
            {ev.status ? <Pill label={ev.status} color={statusColor(colors, ev.status)} /> : null}
          </Card>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  item: { flexDirection: 'row', gap: 10 },
  rail: { alignItems: 'center', width: 28 },
  icon: { fontSize: 20, lineHeight: 28 },
  line: { flex: 1, width: 2, marginTop: 4 },
  card: { flex: 1, padding: 12, gap: 4 },
  italic: { fontStyle: 'italic' },
});
