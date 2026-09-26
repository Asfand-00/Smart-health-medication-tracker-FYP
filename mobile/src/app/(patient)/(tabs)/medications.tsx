/**
 * Medications — port of pages/dashboards/MedicationsPage.jsx.
 * Three views (web tabs): Schedule (per-day, per-time-of-day Take / Skip),
 * Drug information (add / edit / delete), Full history.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { errorMessage } from '../../../api/client';
import { qk } from '../../../api/queryClient';
import { medicationApi } from '../../../api/services';
import { DateNavigator } from '../../../components/DateNavigator';
import { MedicationFormSheet } from '../../../components/MedicationFormSheet';
import { AppText } from '../../../components/ui/AppText';
import { Button, IconButton } from '../../../components/ui/Button';
import { Card, Pill, SectionHeader } from '../../../components/ui/Card';
import { SegmentedControl } from '../../../components/ui/Form';
import { screenStyles, useRefresh } from '../../../components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import { useTheme } from '../../../context/AccessibilityContext';
import { useToast } from '../../../context/ToastContext';
import { spacing } from '../../../theme';
import type { Medication, MedicationPayload, TimeOfDay } from '../../../types/models';
import { TIMES_OF_DAY } from '../../../types/models';
import { confirmAction } from '../../../utils/confirm';
import { endOfDay, formatDate, formatDateOnly, isMedicationActiveOn, startOfDay, toDateKey } from '../../../utils/format';

type Tab = 'schedule' | 'list' | 'history';
const TIME_ICON: Record<TimeOfDay, string> = { Morning: '☀️', Afternoon: '🌤️', Evening: '🌇', Night: '🌙' };

export default function MedicationsScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('schedule');
  const [date, setDate] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [loggingKey, setLoggingKey] = useState<string | null>(null);

  const dayKey = toDateKey(date);
  const meds = useQuery({ queryKey: qk.medications, queryFn: medicationApi.getAll });
  const dayHistory = useQuery({
    queryKey: qk.medicationHistory(dayKey),
    queryFn: () =>
      medicationApi.getHistory({ startDate: startOfDay(date).toISOString(), endDate: endOfDay(date).toISOString() }),
  });
  const fullHistory = useQuery({
    queryKey: qk.medicationHistory('all'),
    queryFn: () => medicationApi.getHistory({}),
    enabled: tab === 'history',
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['medications'] });

  const save = useMutation({
    mutationFn: (payload: MedicationPayload) => (editing ? medicationApi.update(editing._id, payload) : medicationApi.add(payload)),
    onSuccess: () => {
      toast.success(editing ? 'Medication updated successfully' : 'Medication added successfully');
      setFormOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e) => {
      const msg = errorMessage(e);
      // The backend requires a medical profile before a medication can be added.
      if (/profile not found/i.test(msg)) {
        toast.error('Please complete your medical profile before adding medications.');
        setFormOpen(false);
        router.push('/medical-profile');
      } else {
        toast.error(msg || 'Failed to save medication');
      }
    },
  });

  const remove = useMutation({
    mutationFn: medicationApi.remove,
    onSuccess: () => {
      toast.success('Medication deleted');
      invalidate();
    },
    onError: () => toast.error('Failed to delete medication'),
  });

  const logDose = async (med: Medication, time: TimeOfDay, status: 'taken' | 'missed') => {
    const key = `${med._id}-${time}`;
    setLoggingKey(key);
    try {
      await medicationApi.logDose(med._id, { date: date.toISOString(), timeOfDay: time, status });
      toast.success(`Marked as ${status}`);
      invalidate();
    } catch (e) {
      toast.error(errorMessage(e) || 'Failed to log dose');
    } finally {
      setLoggingKey(null);
    }
  };

  const onDelete = async (med: Medication) => {
    if (await confirmAction('Delete medication', `Are you sure you want to delete ${med.medicineName}? Its dose history is deleted too.`)) {
      remove.mutate(med._id);
    }
  };

  const statusFor = (medId: string, time: TimeOfDay) =>
    dayHistory.data?.find((h) => h.medicationId?._id === medId && h.timeOfDay === time)?.status ?? null;

  const byPeriod = useMemo(() => {
    const active = (meds.data ?? []).filter((m) => isMedicationActiveOn(m, date));
    return TIMES_OF_DAY.map((period) => ({ period, meds: active.filter((m) => m.timeOfDay?.includes(period)) })).filter(
      (g) => g.meds.length > 0,
    );
  }, [meds.data, date]);

  const { refreshing, refresh } = useRefresh(() => Promise.all([meds.refetch(), dayHistory.refetch(), fullHistory.refetch()]));
  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />;

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  let body: React.ReactNode;
  if (meds.isPending) body = <LoadingState label="Loading medications…" />;
  else if (meds.isError) body = <ErrorState error={meds.error} onRetry={meds.refetch} />;
  else if (tab === 'schedule') {
    body = (
      <ScrollView contentContainerStyle={screenStyles.listContent} refreshControl={refreshControl}>
        <DateNavigator date={date} onChange={setDate} />
        {byPeriod.length === 0 ? (
          <EmptyState icon="calendar-outline" title="No medications scheduled" message="Nothing is scheduled for this date." action={<Button title="Add medication" icon="add" onPress={openAdd} />} />
        ) : (
          byPeriod.map(({ period, meds: list }) => (
            <View key={period} style={styles.group}>
              <SectionHeader title={`${TIME_ICON[period]} ${period}`} />
              {list.map((med) => {
                const status = statusFor(med._id, period);
                const busy = loggingKey === `${med._id}-${period}`;
                return (
                  <Card key={med._id}>
                    <AppText variant="heading">{med.medicineName}</AppText>
                    <AppText tone="muted">{med.dosage}</AppText>
                    {status === 'taken' ? (
                      <Pill label="✓ Taken" color={colors.success} />
                    ) : status === 'missed' ? (
                      <Pill label="✕ Missed" color={colors.danger} />
                    ) : (
                      <View style={screenStyles.row}>
                        <Button title="Skip" icon="close" variant="secondary" onPress={() => logDose(med, period, 'missed')} disabled={busy} style={screenStyles.flex} accessibilityLabel={`Skip ${period} dose of ${med.medicineName}`} />
                        <Button title="Take" icon="checkmark" variant="success" onPress={() => logDose(med, period, 'taken')} loading={busy} style={screenStyles.flex} accessibilityLabel={`Mark ${period} dose of ${med.medicineName} as taken`} />
                      </View>
                    )}
                  </Card>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    );
  } else if (tab === 'list') {
    body = (
      <FlatList
        data={meds.data}
        keyExtractor={(m) => m._id}
        contentContainerStyle={screenStyles.listContent}
        refreshControl={refreshControl}
        ListHeaderComponent={<Button title="Add medication" icon="add-circle-outline" onPress={openAdd} />}
        ListEmptyComponent={<EmptyState icon="medkit-outline" title="No medications added yet" />}
        renderItem={({ item: med }) => (
          <Card>
            <View style={styles.cardHead}>
              <View style={screenStyles.flex}>
                <AppText variant="heading">{med.medicineName}</AppText>
                <AppText tone="muted">{med.dosage}</AppText>
              </View>
              <IconButton icon="create-outline" accessibilityLabel={`Edit ${med.medicineName}`} onPress={() => { setEditing(med); setFormOpen(true); }} />
              <IconButton icon="trash-outline" color={colors.danger} accessibilityLabel={`Delete ${med.medicineName}`} onPress={() => onDelete(med)} />
            </View>
            <AppText variant="caption" tone="faint">
              {med.frequency} • {med.timeOfDay.join(', ')}
            </AppText>
            <AppText variant="caption" tone="faint">
              {formatDateOnly(med.startDate)}
              {med.endDate ? ` — ${formatDateOnly(med.endDate)}` : ' (Ongoing)'}
            </AppText>
            {/* ternary, not &&: an empty-string condition would render a bare text node (a crash on native) */}
            {med.description || med.notes ? (
              <View style={[styles.info, { backgroundColor: colors.surfaceAlt }]}>
                <AppText variant="label" tone="primary">Drug information</AppText>
                {med.description ? <AppText variant="caption">{med.description}</AppText> : null}
                {med.notes ? <AppText variant="caption" tone="muted">Instructions: {med.notes}</AppText> : null}
              </View>
            ) : null}
          </Card>
        )}
      />
    );
  } else {
    body = fullHistory.isPending ? (
      <LoadingState label="Loading history…" />
    ) : fullHistory.isError ? (
      <ErrorState error={fullHistory.error} onRetry={fullHistory.refetch} />
    ) : (
      <FlatList
        data={fullHistory.data}
        keyExtractor={(h) => h._id}
        contentContainerStyle={screenStyles.listContent}
        refreshControl={refreshControl}
        initialNumToRender={20}
        ListEmptyComponent={<EmptyState icon="time-outline" title="No logs available yet" />}
        renderItem={({ item }) => (
          <Card style={styles.historyRow}>
            <View style={screenStyles.flex}>
              <AppText weight="700">{item.medicationId?.medicineName ?? 'Unknown medication'}</AppText>
              <AppText variant="caption" tone="faint">
                {formatDate(item.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} • {item.timeOfDay}
              </AppText>
            </View>
            <Pill label={item.status === 'taken' ? '✓ Taken' : '✕ Missed'} color={item.status === 'taken' ? colors.success : colors.danger} />
          </Card>
        )}
      />
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <View style={styles.tabs}>
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'schedule', label: 'Schedule' },
            { value: 'list', label: 'Drug info' },
            { value: 'history', label: 'History' },
          ]}
        />
      </View>
      {body}
      <MedicationFormSheet
        visible={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSubmit={(p) => save.mutate(p)}
        editing={editing}
        title={editing ? 'Edit Medication' : 'Add New Medication'}
        saving={save.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  tabs: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  group: { gap: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  info: { borderRadius: 10, padding: 10, gap: 4 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
