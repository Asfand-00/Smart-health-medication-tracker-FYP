/**
 * Calendar-based medication view — GET /medication/calendar?month=YYYY-MM.
 * Month grid coloured by the day's outcome; tap a day for its dose list.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { qk } from '../api/queryClient';
import { medicationApi } from '../api/services';
import { PatientPicker, usePatientContext } from '../components/PatientContext';
import { AppText } from '../components/ui/AppText';
import { IconButton } from '../components/ui/Button';
import { Card, Pill, SectionHeader, StatTile } from '../components/ui/Card';
import { Screen, screenStyles } from '../components/ui/Screen';
import { ErrorState, LoadingState } from '../components/ui/States';
import { useTheme } from '../context/AccessibilityContext';
import { radius } from '../theme';
import type { CalendarDay } from '../types/models';
import { formatDate, fromDateKey } from '../utils/format';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export default function CalendarScreen() {
  const { colors, highContrast } = useTheme();
  const ctx = usePatientContext();
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState<string | null>(null);
  const month = monthKey(cursor);

  const calendar = useQuery({
    queryKey: qk.medicationCalendar(ctx.patientId, month),
    queryFn: () => medicationApi.calendar(month, ctx.patientParam),
    enabled: Boolean(ctx.patientId),
  });

  const colorFor = (d: CalendarDay) => {
    switch (d.summary) {
      case 'complete':
        return colors.success;
      case 'partial':
        return colors.warning;
      case 'missed':
        return colors.danger;
      case 'pending':
        return colors.primary;
      case 'upcoming':
        return colors.textFaint;
      default:
        return 'transparent';
    }
  };

  const weeks = useMemo(() => {
    const days = calendar.data?.days ?? [];
    if (!days.length) return [];
    const firstDow = fromDateKey(days[0].date).getDay();
    const cells: (CalendarDay | null)[] = [...Array(firstDow).fill(null), ...days];
    while (cells.length % 7) cells.push(null);
    const rows: (CalendarDay | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [calendar.data]);

  const day = calendar.data?.days.find((d) => d.date === selected) ?? calendar.data?.days.find((d) => d.isToday) ?? null;
  const data = calendar.data;

  return (
    <Screen onRefresh={() => calendar.refetch()}>
      <PatientPicker ctx={ctx} />
      {ctx.patientId ? (
        <>
          <View style={[styles.monthRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconButton icon="chevron-back" accessibilityLabel="Previous month" onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} />
            <AppText variant="heading" accessibilityRole="header">
              {formatDate(cursor, { month: 'long', year: 'numeric' })}
            </AppText>
            <IconButton icon="chevron-forward" accessibilityLabel="Next month" onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} />
          </View>

          {calendar.isPending ? (
            <LoadingState label="Loading calendar…" />
          ) : calendar.isError ? (
            <ErrorState error={calendar.error} onRetry={calendar.refetch} />
          ) : data ? (
            <>
              <View style={screenStyles.wrap}>
                <StatTile label="Scheduled so far" value={data.summary.scheduled} icon="calendar-outline" color={colors.primary} />
                <StatTile label="Taken" value={data.summary.taken} icon="checkmark-done-outline" color={colors.success} />
                <StatTile label="Missed / skipped" value={data.summary.missed} icon="close-circle-outline" color={colors.danger} />
                <StatTile label="Month adherence" value={`${data.summary.adherencePercent}%`} icon="trending-up-outline" color={colors.teal} />
              </View>

              <Card>
                <View style={styles.weekRow}>
                  {WEEKDAYS.map((w) => (
                    <AppText key={w} variant="label" tone="faint" align="center" style={styles.cell}>
                      {w}
                    </AppText>
                  ))}
                </View>
                {weeks.map((row, ri) => (
                  <View key={ri} style={styles.weekRow}>
                    {row.map((d, ci) =>
                      d ? (
                        <Pressable
                          key={d.date}
                          onPress={() => setSelected(d.date)}
                          accessibilityRole="button"
                          accessibilityLabel={`${formatDate(fromDateKey(d.date), { dateStyle: 'full' })}: ${d.total ? `${d.taken + d.delayed} of ${d.total} doses taken` : 'nothing scheduled'}`}
                          style={[
                            styles.cell,
                            styles.dayCell,
                            {
                              borderColor: d.date === (selected ?? day?.date) ? (highContrast ? '#ffff00' : colors.primary) : d.isToday ? colors.borderStrong : 'transparent',
                              backgroundColor: colors.surfaceAlt,
                            },
                          ]}
                        >
                          <AppText variant="caption" weight={d.isToday ? '800' : '500'}>
                            {Number(d.date.slice(-2))}
                          </AppText>
                          <View style={[styles.dot, { backgroundColor: colorFor(d), borderColor: highContrast ? '#fff' : 'transparent', borderWidth: highContrast && d.summary !== 'none' ? 1 : 0 }]} />
                        </Pressable>
                      ) : (
                        <View key={`e${ri}-${ci}`} style={styles.cell} />
                      ),
                    )}
                  </View>
                ))}
                <View style={screenStyles.wrap}>
                  <Pill label="All taken" color={colors.success} />
                  <Pill label="Partly taken" color={colors.warning} />
                  <Pill label="Missed" color={colors.danger} />
                  <Pill label="Pending today" color={colors.primary} />
                  <Pill label="Upcoming" color={colors.textFaint} />
                </View>
              </Card>

              {day && (
                <>
                  <SectionHeader title={day.isToday ? 'Today' : formatDate(fromDateKey(day.date), { weekday: 'long', day: 'numeric', month: 'long' })} icon="today-outline" />
                  {day.items.length === 0 ? (
                    <Card>
                      <AppText tone="faint">No medications scheduled on this day.</AppText>
                    </Card>
                  ) : (
                    day.items.map((it, i) => {
                      const c = it.status === 'taken' || it.status === 'delayed' ? colors.success : it.status === 'missed' || it.status === 'skipped' ? colors.danger : colors.primary;
                      return (
                        <Card key={`${it.medicationId}-${it.timeOfDay}-${i}`} style={styles.itemRow}>
                          <View style={screenStyles.flex}>
                            <AppText weight="700">{it.medicineName}</AppText>
                            <AppText variant="caption" tone="faint">
                              {it.dosage} · {it.timeOfDay}
                            </AppText>
                          </View>
                          <Pill label={it.status} color={c} />
                        </Card>
                      );
                    })
                  )}
                </>
              )}
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 4 },
  weekRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  cell: { flex: 1, minHeight: 20 },
  dayCell: { alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 46, borderRadius: 8, borderWidth: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
