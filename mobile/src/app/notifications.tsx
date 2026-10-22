/**
 * Notification inbox — GET /notifications/history with type / priority /
 * read filters, mark read, mark all read, delete, infinite scroll, and the
 * per-channel delivery log of each alert (notification history logs).
 */
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import { qk } from '../api/queryClient';
import { notificationApi } from '../api/services';
import { DeliveryPills } from '../components/DeliveryPills';
import { useUnreadCount } from '../components/HeaderActions';
import { AppText } from '../components/ui/AppText';
import { Button, IconButton } from '../components/ui/Button';
import { Card, Pill } from '../components/ui/Card';
import { SelectField } from '../components/ui/Form';
import { screenStyles, useRefresh } from '../components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { useTheme } from '../context/AccessibilityContext';
import { useToast } from '../context/ToastContext';
import type { AppNotification } from '../types/models';
import { formatDateTime } from '../utils/format';

const TYPES = [
  { value: '', label: 'All event types' },
  { value: 'reminder', label: 'Reminders' },
  { value: 'missed_dose', label: 'Missed doses' },
  { value: 'escalation', label: 'Escalations' },
  { value: 'ai_alert', label: 'AI predictions & risks' },
  { value: 'prescription', label: 'Prescriptions' },
  { value: 'plan_request', label: 'Plan approvals' },
  { value: 'doctor_note', label: 'Doctor notes' },
  { value: 'cognitive_alert', label: 'Cognitive decline' },
  { value: 'behavioral_alert', label: 'Behavioral concerns' },
  { value: 'adherence_update', label: 'Adherence updates' },
  { value: 'medication_update', label: 'Medication updates' },
  { value: 'mood_update', label: 'Mood updates' },
  { value: 'connection_request', label: 'Care team requests' },
  { value: 'security', label: 'Security' },
  { value: 'system', label: 'System' },
];
const PRIORITIES = [
  { value: '', label: 'All priorities' },
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];
const READ = [
  { value: '', label: 'Read & unread' },
  { value: 'false', label: 'Unread only' },
  { value: 'true', label: 'Read only' },
];

/** Where a tap on a notification should take the user. */
function targetFor(n: AppNotification): string | null {
  if (n.type === 'prescription' && n.relatedId) return `/prescription/${n.relatedId}`;
  if (n.type === 'plan_request') return '/plan-requests';
  if (n.type === 'ai_alert') return '/ai-insights';
  return null;
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [type, setType] = useState('');
  const [priority, setPriority] = useState('');
  const [isRead, setIsRead] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const unread = useUnreadCount();

  const filters = { type, priority, isRead };
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
          <View style={screenStyles.row}>
            <AppText tone="muted" style={screenStyles.flex}>
              {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}.` : 'All caught up! No unread notifications.'}
            </AppText>
            <IconButton icon="options-outline" accessibilityLabel="Notification settings" onPress={() => router.push('/notification-settings')} />
          </View>
          {unreadCount > 0 && <Button title="Mark all read" icon="checkmark-done-outline" variant="secondary" loading={markAll.isPending} onPress={() => markAll.mutate()} />}
          <SelectField label="Type" value={type} options={TYPES} onChange={setType} />
          <View style={screenStyles.row}>
            <View style={screenStyles.flex}>
              <SelectField label="Priority" value={priority} options={PRIORITIES} onChange={setPriority} />
            </View>
            <View style={screenStyles.flex}>
              <SelectField label="Status" value={isRead} options={READ} onChange={setIsRead} />
            </View>
          </View>
        </View>
      }
      ListEmptyComponent={
        list.isPending ? <LoadingState /> : list.isError ? <ErrorState error={list.error} onRetry={list.refetch} /> : <EmptyState icon="notifications-off-outline" title="No notifications match your current selection." />
      }
      ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null}
      renderItem={({ item: n }) => {
        const accent = n.priority === 'critical' ? colors.danger : n.priority === 'high' ? colors.orange : n.isRead ? undefined : colors.primary;
        const target = targetFor(n);
        const open = expanded === n._id;
        return (
          <Card accent={accent} style={n.isRead ? { opacity: 0.8 } : undefined}>
            <View style={screenStyles.row}>
              <View style={screenStyles.flex}>
                <AppText weight={n.isRead ? '500' : '800'}>{n.title}</AppText>
                <AppText variant="caption" tone="faint">
                  {formatDateTime(n.createdAt)}
                </AppText>
              </View>
              {!n.isRead && <IconButton icon="checkmark" accessibilityLabel={`Mark "${n.title}" as read`} onPress={() => markRead.mutate(n._id)} />}
              <IconButton icon="trash-outline" color={colors.danger} accessibilityLabel={`Delete "${n.title}"`} onPress={() => remove.mutate(n._id)} />
            </View>
            {n.message ? <AppText tone="muted">{n.message}</AppText> : null}
            <View style={screenStyles.wrap}>
              {n.priority !== 'normal' && <Pill label={`${n.priority} priority`} color={accent ?? colors.textFaint} />}
              <Pill label={n.type.replace(/_/g, ' ')} color={colors.textFaint} />
            </View>
            <View style={screenStyles.row}>
              {target ? <Button title="Open" variant="ghost" icon="open-outline" onPress={() => router.push(target as never)} /> : null}
              {n.deliveries && n.deliveries.length > 0 ? (
                <Button title={open ? 'Hide delivery log' : 'Delivery log'} variant="ghost" icon={open ? 'chevron-up' : 'chevron-down'} onPress={() => setExpanded(open ? null : n._id)} />
              ) : null}
            </View>
            {open && n.deliveries ? <DeliveryPills deliveries={n.deliveries} verbose /> : null}
          </Card>
        );
      }}
    />
  );
}
