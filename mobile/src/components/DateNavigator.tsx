import { StyleSheet, View } from 'react-native';

import { useTheme } from '../context/AccessibilityContext';
import { radius } from '../theme';
import { addDays, formatDate, isSameDay } from '../utils/format';
import { AppText } from './ui/AppText';
import { IconButton } from './ui/Button';

/** Previous / next day control (web: chevron buttons or <input type="date">). */
export function DateNavigator({ date, onChange }: { date: Date; onChange: (d: Date) => void }) {
  const { colors, borderWidth } = useTheme();
  const today = isSameDay(date, new Date());
  const label = today ? 'Today' : formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth }]}>
      <IconButton icon="chevron-back" accessibilityLabel="Previous day" onPress={() => onChange(addDays(date, -1))} />
      <View style={styles.center} accessible accessibilityRole="text" accessibilityLabel={`Showing ${formatDate(date, { dateStyle: 'full' })}`}>
        <AppText weight="700">{label}</AppText>
        {!today && (
          <AppText variant="caption" tone="primary" onPress={() => onChange(new Date())} accessibilityRole="button">
            Jump to today
          </AppText>
        )}
      </View>
      <IconButton icon="chevron-forward" accessibilityLabel="Next day" onPress={() => onChange(addDays(date, 1))} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md },
  center: { flex: 1, alignItems: 'center' },
});
