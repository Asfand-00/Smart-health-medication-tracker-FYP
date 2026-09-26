/**
 * Notification inbox — port of pages/NotificationCenterPage.jsx and the
 * NotificationCenter drawer. Type / priority filters, mark read, mark all
 * read, delete, infinite scroll.
 *
 * Uses GET /notifications/history, which applies the type/priority filters —
 * the web page sends them to GET /notifications, which ignores them.
 */
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import { qk } from '../api/queryClient';
import { notificationApi } from '../api/services';
import { AppText } from '../components/ui/AppText';
import { Button, IconButton } from '../components/ui/Button';
import { Card, Pill } from '../components/ui/Card';
import { SelectField } from '../components/ui/Form';
import { screenStyles, useRefresh } from '../components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { useUnreadCount } from '../components/HeaderActions';
import { useTheme } from '../context/AccessibilityContext';
import { useToast } from '../context/ToastContext';
import { formatDateTime } from '../utils/format';

const TYPES = [
  { value: '', label: 'All event types' },
  { value: 'reminder', label: 'Reminders' },
  { value: 'missed_dose', label: 'Missed doses' },
  { value: 'escalation', label: 'Escalations' },
  { value: 'cognitive_alert', label: 'Cognitive decline' },
  { value: 'behavioral_alert', label: 'Behavioral concerns' },
  { value: 'adherence_update', label: 'Adherence updates' },
  { value: 'medication_update', label: 'Medication updates' },
  { value: 'mood_update', label: 'Mood updates' },
];
const PRIORITIES = [
  { value: '', label: 'All priorities' },
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [type, setType] = useState('');
  const [priority, setPriority] = useState('');
  const unread = useUnreadCount();

  const filters = { type, priority };
  const list = useInfiniteQuery({
    queryKey: qk.notifications(filters),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => notificationApi.getHistory({ ...filters, page: pageParam, limit: 20 }),
    getNextPageParam: (last, all) => (all.length < last.totalPages ? all.length + 1 : undefined),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const markRead = useMutation({ mutationFn: notificationApi.markAsRead, onSuccess: invalidate, onError: () => toast.error('Failed to mark as read') });
  const markAll = useMutation({
    mutationFn: notificationApi.markAllAsRead,
    onSuccess: () => {
      toast.success('All notifications marked as read');
      invalidate();
    },
    onError: () => toast.error('Failed to mark all as read'),
  });
  const remove = useMutation({
    mutationFn: notificationApi.remove,
    onSuccess: () => {
      toast.success('Notification deleted');
      invalidate();
    },
    onError: () => toast.error('Failed to delete notification'),
  });

  const items = list.data?.pages.flatMap((p) => p.notifications) ?? [];
  const unreadCount = unread.data ?? 0;
  const { refreshing, refresh } = useRefresh(() => Promise.all([list.refetch(), unread.refetch()]));

  return (
    <FlatList
      data={items}
      keyExtractor={(n) => n._id}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={screenStyles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
      }}
      ListHeaderComponent={
        <View style={screenStyles.gap}>
          <AppText tone="muted">
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}.` : 'All caught up! No unread notifications.'}
          </AppText>
          {unreadCount > 0 && <Button title="Mark all read" icon="checkmark-done-outline" variant="secondary" loading={markAll.isPending} onPress={() => markAll.mutate()} />}
          <View style={screenStyles.row}>
            <View style={screenStyles.flex}>
              <SelectField label="Type" value={type} options={TYPES} onChange={setType} />
            </View>
            <View style={screenStyles.flex}>
              <SelectField label="Priority" value={priority} options={PRIORITIES} onChange={setPriority} />
            </View>
          </View>
        </View>
      }
      ListEmptyComponent={
        list.isPending ? (
          <LoadingState />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={list.refetch} />
        ) : (
          <EmptyState icon="notifications-off-outline" title="No notifications match your current selection." />
        )
      }
      ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null}
      renderItem={({ item: n }) => {
        const accent = n.priority === 'critical' ? colors.danger : n.priority === 'high' ? colors.orange : n.isRead ? undefined : colors.primary;
        return (
          <Card accent={accent} style={n.isRead ? { opacity: 0.75 } : undefined}>
            <View style={screenStyles.row}>
              <View style={screenStyles.flex}>
                <AppText weight={n.isRead ? '500' : '800'}>{n.title}</AppText>
                <AppText variant="caption" tone="faint">{formatDateTime(n.createdAt)}</AppText>
              </View>
              {!n.isRead && <IconButton icon="checkmark" accessibilityLabel={`Mark "${n.title}" as read`} onPress={() => markRead.mutate(n._id)} />}
              <IconButton icon="trash-outline" color={colors.danger} accessibilityLabel={`Delete "${n.title}"`} onPress={() => remove.mutate(n._id)} />
            </View>
            {n.message ? <AppText tone="muted">{n.message}</AppText> : null}
            {n.priority !== 'normal' && <Pill label={`${n.priority} priority`} color={accent ?? colors.textFaint} />}
          </Card>
        );
      }}
    />
  );
}
