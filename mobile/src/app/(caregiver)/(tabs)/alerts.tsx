/**
 * Alerts hub — port of pages/CaregiverAlertsPage.jsx.
 * GET /caregiver-dashboard/alerts (unread missed_dose / escalation / cognitive /
 * behavioural notifications); dismiss = PATCH /notifications/:id/read.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { qk } from '../../../api/queryClient';
import { caregiverDashboardApi, notificationApi } from '../../../api/services';
import { AppText } from '../../../components/ui/AppText';
import { Button } from '../../../components/ui/Button';
import { Card, Pill } from '../../../components/ui/Card';
import { screenStyles, useRefresh } from '../../../components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import { useTheme } from '../../../context/AccessibilityContext';
import { useToast } from '../../../context/ToastContext';
import type { AppNotification, UserRef } from '../../../types/models';
import { formatDateTime, fullName } from '../../../utils/format';

const ICON: Record<string, string> = { missed_dose: '💊', escalation: '🚨', cognitive_alert: '🧠', behavioral_alert: '👁️' };

export default function AlertsScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const alerts = useQuery({ queryKey: qk.caregiverAlerts, queryFn: caregiverDashboardApi.getAlerts });

  const dismiss = useMutation({
    mutationFn: notificationApi.markAsRead,
    onSuccess: (_d, id) => {
      queryClient.setQueryData<AppNotification[]>(qk.caregiverAlerts, (prev) => prev?.filter((a) => a._id !== id));
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Alert dismissed.');
    },
    onError: () => toast.error('Failed to dismiss alert.'),
  });

  const { refreshing, refresh } = useRefresh(() => alerts.refetch());
  const accent = (type: string) =>
    type === 'cognitive_alert' ? colors.warning : type === 'behavioral_alert' ? colors.purple : colors.danger;

  if (alerts.isPending) return <LoadingState label="Loading alerts…" />;
  if (alerts.isError && !alerts.data) return <ErrorState error={alerts.error} onRetry={alerts.refetch} />;

  return (
    <FlatList
      data={alerts.data}
      keyExtractor={(a) => a._id}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={screenStyles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      ListHeaderComponent={
        <AppText tone="muted">
          {alerts.data?.length ? `You have ${alerts.data.length} active alerts requiring your attention.` : 'No active alerts at this time.'}
        </AppText>
      }
      ListEmptyComponent={
        <EmptyState icon="checkmark-done-circle-outline" title="All clear" message="There are no active patient alerts. All patients are currently adhering to their schedules." />
      }
      renderItem={({ item }) => {
        const from = item.fromUserId && typeof item.fromUserId === 'object' ? (item.fromUserId as UserRef) : null;
        return (
          <Card accent={accent(item.type)}>
            <View style={styles.head}>
              <AppText style={styles.icon}>{ICON[item.type] ?? '⚠️'}</AppText>
              <View style={screenStyles.flex}>
                <AppText weight="700">{item.title}</AppText>
                <AppText tone="muted">{item.message}</AppText>
              </View>
            </View>
            <AppText variant="caption" tone="faint">
              Patient: {from ? fullName(from) : 'Unknown patient'} · {formatDateTime(item.createdAt)}
            </AppText>
            <View style={styles.foot}>
              <Pill label={item.priority} color={item.priority === 'critical' ? colors.danger : colors.orange} />
              <Button title="Dismiss" icon="checkmark" variant="secondary" loading={dismiss.isPending && dismiss.variables === item._id} onPress={() => dismiss.mutate(item._id)} accessibilityLabel={`Dismiss alert: ${item.title}`} />
            </View>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: 10 },
  icon: { fontSize: 26, lineHeight: 32 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
