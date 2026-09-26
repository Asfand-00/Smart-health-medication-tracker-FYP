/**
 * Smart reminders — port of pages/SmartRemindersPage.jsx.
 * On load: POST /smart-reminders/generate, then GET /smart-reminders/upcoming.
 * Each pending dose gets large tactile buttons (I TOOK IT / LATER / SKIP) that
 * call POST /smart-reminders/acknowledge/:id, with spoken feedback when voice
 * prompts are on.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { errorMessage } from '../../../api/client';
import { qk } from '../../../api/queryClient';
import { smartReminderApi } from '../../../api/services';
import { AppText } from '../../../components/ui/AppText';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { screenStyles, useRefresh } from '../../../components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import { useAccessibility, useTheme } from '../../../context/AccessibilityContext';
import { useToast } from '../../../context/ToastContext';
import type { AckStatus, Medication, Reminder } from '../../../types/models';

const TIME_STYLE: Record<string, { emoji: string }> = {
  Morning: { emoji: '☀️' },
  Afternoon: { emoji: '🌤️' },
  Evening: { emoji: '🌇' },
  Night: { emoji: '🌙' },
};

function timeOfDay(r: Reminder): string {
  const t = (r.title || '').toLowerCase();
  if (t.includes('morning')) return 'Morning';
  if (t.includes('afternoon')) return 'Afternoon';
  if (t.includes('evening')) return 'Evening';
  if (t.includes('night')) return 'Night';
  return 'Morning';
}

type MedRef = Pick<Medication, '_id' | 'medicineName' | 'dosage' | 'notes'>;
function medOf(r: Reminder): MedRef | null {
  return r.medicationId && typeof r.medicationId === 'object' ? r.medicationId : null;
}

async function generateThenFetch(): Promise<Reminder[]> {
  await smartReminderApi.generate();
  return smartReminderApi.getUpcoming();
}

export default function TodayScreen() {
  const { colors } = useTheme();
  const { speakText } = useAccessibility();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const reminders = useQuery({ queryKey: qk.smartReminders, queryFn: generateThenFetch });

  const ack = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AckStatus }) => smartReminderApi.acknowledge(id, status),
    onMutate: ({ id }) => setConfirmingId(id),
    onSuccess: (_d, { id, status }) => {
      toast.success(`Dose marked as ${status}! ✅`);
      queryClient.setQueryData<Reminder[]>(qk.smartReminders, (prev) => prev?.filter((r) => r._id !== id));
      queryClient.invalidateQueries({ queryKey: ['adherence'] });
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      if (status === 'taken') speakText('Thank you. Your dosage has been successfully recorded and your caregiver has been notified.');
      else if (status === 'delayed') speakText('Noted. We will remind you again shortly.');
      else speakText('Recorded. Your caregiver has been notified about this skipped dose.');
    },
    onError: (e) => toast.error(errorMessage(e) || 'Failed to update dose confirmation.'),
    onSettled: () => setConfirmingId(null),
  });

  const { refreshing, refresh } = useRefresh(() => reminders.refetch());
  const list = reminders.data ?? [];

  if (reminders.isPending) return <LoadingState label="Loading your medications…" />;
  if (reminders.isError && !reminders.data) return <ErrorState error={reminders.error} onRetry={reminders.refetch} />;

  return (
    <FlatList
      data={list}
      keyExtractor={(r) => r._id}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={screenStyles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <AppText variant="title" accessibilityRole="header">
            ⏰ Medication schedule for today
          </AppText>
          <AppText tone="muted">
            {list.length > 0
              ? `You have ${list.length} pending medication${list.length > 1 ? 's' : ''}. Tap to confirm.`
              : 'All caught up! No pending medications scheduled.'}
          </AppText>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon="happy-outline"
          title="No pending medications 🎉"
          message="Awesome job staying healthy! Pull down to refresh your schedule."
        />
      }
      ListFooterComponent={
        <Card>
          <AppText variant="caption" tone="muted">
            💡 <AppText variant="caption" weight="700">Caregiver notified:</AppText> every dose you take or skip is shared with your caregiver in
            real time. If a dose goes unconfirmed for 30 minutes, escalation alerts trigger automatically.
          </AppText>
        </Card>
      }
      renderItem={({ item }) => {
        const med = medOf(item);
        const tod = timeOfDay(item);
        const busy = confirmingId === item._id;
        const name = med?.medicineName ?? 'Medication';
        return (
          <Card style={styles.card}>
            <View style={styles.row}>
              <AppText style={styles.pill}>💊</AppText>
              <View style={screenStyles.flex}>
                <AppText variant="title">{name}</AppText>
                <AppText tone="muted">
                  {med?.dosage ?? 'As prescribed'} · {TIME_STYLE[tod]?.emoji} {tod}
                </AppText>
              </View>
            </View>
            {med?.notes ? <AppText tone="faint">💡 {med.notes}</AppText> : null}
            <Button
              title="I TOOK IT"
              icon="checkmark-circle"
              variant="success"
              size="xl"
              loading={busy && ack.variables?.status === 'taken'}
              disabled={busy}
              onPress={() => ack.mutate({ id: item._id, status: 'taken' })}
              accessibilityLabel={`I took ${name}`}
            />
            <View style={screenStyles.row}>
              <Button
                title="LATER"
                icon="time-outline"
                variant="warning"
                size="lg"
                disabled={busy}
                onPress={() => ack.mutate({ id: item._id, status: 'delayed' })}
                style={screenStyles.flex}
                accessibilityLabel={`Take ${name} later`}
              />
              <Button
                title="SKIP"
                icon="close-circle"
                variant="danger"
                size="lg"
                disabled={busy}
                onPress={() => ack.mutate({ id: item._id, status: 'skipped' })}
                style={screenStyles.flex}
                accessibilityLabel={`Skip ${name}`}
              />
            </View>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  header: { gap: 4, marginBottom: 4 },
  card: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pill: { fontSize: 32, lineHeight: 40 },
});
