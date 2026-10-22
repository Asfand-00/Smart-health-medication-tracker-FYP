/**
 * Caregiver reminders inbox — port of pages/dashboards/RemindersPage.jsx.
 * GET /reminders (includes smart-reminder records and caregiver pokes),
 * PATCH /reminders/:id/read.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { qk } from '../../api/queryClient';
import { reminderApi } from '../../api/services';
import { AppText } from '../../components/ui/AppText';
import { IconButton } from '../../components/ui/Button';
import { Card, Pill } from '../../components/ui/Card';
import { screenStyles, useRefresh } from '../../components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { useTheme } from '../../context/AccessibilityContext';
import { useToast } from '../../context/ToastContext';
import type { Reminder, ReminderType, UserRef } from '../../types/models';
import { formatDateTime, fullName } from '../../utils/format';

const TYPE_ICON: Record<ReminderType, string> = {
  medication: '💊',
  appointment: '🩺',
  exercise: '🏃',
  meal: '🍽️',
  poke: '👋',
  general: '🔔',
};

export default function RemindersScreen() {
  const theme = useTheme();
  const { colors } = theme;
  const toast = useToast();
  const queryClient = useQueryClient();
  const reminders = useQuery({ queryKey: qk.reminders, queryFn: reminderApi.getMine });

  const markRead = useMutation({
    mutationFn: reminderApi.markAsRead,
    onSuccess: (_d, id) =>
      queryClient.setQueryData<Reminder[]>(qk.reminders, (prev) => prev?.map((r) => (r._id === id ? { ...r, isRead: true } : r))),
    onError: () => toast.error('Failed to mark as read'),
  });

  const { refreshing, refresh } = useRefresh(() => reminders.refetch());
  const accentFor = (t: ReminderType) =>
    ({ medication: colors.primary, appointment: colors.purple, exercise: colors.success, meal: colors.warning, poke: colors.orange, general: colors.teal })[t] ??
    colors.teal;

  if (reminders.isPending) return <LoadingState label="Loading reminders…" />;
  if (reminders.isError && !reminders.data) return <ErrorState error={reminders.error} onRetry={reminders.refetch} />;
  const unread = (reminders.data ?? []).filter((r) => !r.isRead).length;

  return (
    <FlatList
      data={reminders.data}
      keyExtractor={(r) => r._id}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={screenStyles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      ListHeaderComponent={
        <AppText tone={unread ? 'primary' : 'muted'} weight={unread ? '700' : '400'}>
          {unread > 0 ? `${unread} unread reminder${unread > 1 ? 's' : ''}` : 'All caught up! No unread reminders.'}
        </AppText>
      }
      ListEmptyComponent={<EmptyState icon="notifications-outline" title="No reminders yet" message="Your caregiver's reminders will appear here." />}
      renderItem={({ item }) => {
        const from = item.createdBy && typeof item.createdBy === 'object' ? (item.createdBy as UserRef) : null;
        return (
          <Card accent={accentFor(item.reminderType)} style={item.isRead ? styles.read : undefined}>
            <View style={styles.head}>
              <AppText style={styles.icon}>{TYPE_ICON[item.reminderType] ?? '🔔'}</AppText>
              <View style={screenStyles.flex}>
                <AppText weight="700">{item.title}</AppText>
                {!item.isRead && <Pill label="New" color={colors.primary} />}
              </View>
              {!item.isRead && (
                <IconButton icon="checkmark-done-outline" accessibilityLabel={`Mark "${item.title}" as read`} onPress={() => markRead.mutate(item._id)} />
              )}
            </View>
            {item.message ? <AppText tone="muted">{item.message}</AppText> : null}
            <AppText variant="caption" tone="faint">
              {formatDateTime(item.createdAt)}
              {from && from._id !== item.patientUserId ? ` · From: ${fullName(from)}` : ''}
            </AppText>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  icon: { fontSize: 24, lineHeight: 30 },
  read: { opacity: 0.7 },
});
