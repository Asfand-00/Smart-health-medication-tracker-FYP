/**
 * Notification & alert management — broadcast to roles, platform-wide
 * notification log with per-type counts and failed deliveries, critical /
 * escalation / AI alerts and high-risk patients (GET /admin/alerts).
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { errorMessage } from '../../../api/client';
import { qk } from '../../../api/queryClient';
import { adminApi } from '../../../api/services';
import { DeliveryPills } from '../../../components/DeliveryPills';
import { RiskBadge } from '../../../components/RiskBadge';
import { AppText } from '../../../components/ui/AppText';
import { Button, IconButton } from '../../../components/ui/Button';
import { Card, Pill, SectionHeader, StatTile } from '../../../components/ui/Card';
import { ChipGroup, SegmentedControl, SelectField, TextField } from '../../../components/ui/Form';
import { Screen, screenStyles } from '../../../components/ui/Screen';
import { Sheet } from '../../../components/ui/Sheet';
import { ErrorState, LoadingState } from '../../../components/ui/States';
import { useTheme } from '../../../context/AccessibilityContext';
import { useToast } from '../../../context/ToastContext';
import type { Priority, Role, UserRef } from '../../../types/models';
import { formatDateTime, fullName } from '../../../utils/format';

export default function AdminAlerts() {
  const toast = useToast();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'alerts' | 'log'>('alerts');
  const alerts = useQuery({ queryKey: qk.adminAlerts, queryFn: adminApi.alerts });
  const [type, setType] = useState('');
  const [failed, setFailed] = useState('');
  const log = useInfiniteQuery({
    queryKey: qk.adminNotifications({ type, failed }),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => adminApi.notifications({ type, failed, page: pageParam, limit: 25 }),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled: view === 'log',
  });
  const remove = useMutation({ mutationFn: adminApi.deleteNotification, onSuccess: () => { toast.success('Deleted.'); queryClient.invalidateQueries({ queryKey: ['admin'] }); }, onError: (e) => toast.error(errorMessage(e)) });

  const [bcOpen, setBcOpen] = useState(false);
  const [bc, setBc] = useState<{ title: string; message: string; roles: Role[]; priority: Priority; channel: 'in_app' | 'both' | 'all' }>({ title: '', message: '', roles: ['patient', 'caregiver', 'doctor'], priority: 'normal', channel: 'in_app' });
  const broadcast = useMutation({
    mutationFn: () => adminApi.broadcast(bc),
    onSuccess: (r) => {
      toast.success(`Broadcast sent to ${r.recipients} user${r.recipients === 1 ? '' : 's'}.`);
      setBcOpen(false);
      setBc((b) => ({ ...b, title: '', message: '' }));
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const byType = log.data?.pages[0]?.byType ?? {};
  const typeOptions = [{ value: '', label: 'All types' }, ...Object.keys(byType).sort().map((t) => ({ value: t, label: `${t.replace(/_/g, ' ')} (${byType[t]})` }))];
  const items = log.data?.pages.flatMap((p) => p.notifications) ?? [];

  return (
    <Screen onRefresh={() => Promise.all([alerts.refetch(), log.refetch()])}>
      <Button title="Send a broadcast" icon="megaphone-outline" onPress={() => setBcOpen(true)} />
      <SegmentedControl value={view} onChange={setView} options={[{ value: 'alerts', label: 'Active alerts' }, { value: 'log', label: 'Notification log' }]} />

      {view === 'alerts' ? (
        alerts.isPending ? (
          <LoadingState />
        ) : alerts.isError ? (
          <ErrorState error={alerts.error} onRetry={alerts.refetch} />
        ) : alerts.data ? (
          <>
            <View style={screenStyles.wrap}>
              <StatTile label="Critical (7d)" value={alerts.data.critical.length} icon="alert-circle-outline" color={colors.danger} />
              <StatTile label="Escalations (7d)" value={alerts.data.escalationsThisWeek} icon="arrow-up-circle-outline" color={colors.orange} />
              <StatTile label="AI alerts (7d)" value={alerts.data.aiAlerts.length} icon="sparkles-outline" color={colors.purple} />
              <StatTile label="High-risk patients" value={alerts.data.highRiskPatients.length} icon="warning-outline" color={colors.warning} />
            </View>
            <SectionHeader title="High-risk patients" icon="warning-outline" />
            {alerts.data.highRiskPatients.length === 0 ? (
              <Card>
                <AppText tone="faint">No patient is rated high or critical.</AppText>
              </Card>
            ) : (
              alerts.data.highRiskPatients.map((r) => (
                <Card key={r._id} style={screenStyles.row}>
                  <View style={screenStyles.flex}>
                    <AppText weight="700">{fullName(r.patientUserId as UserRef)}</AppText>
                    <AppText variant="caption" tone="faint">
                      {(r.patientUserId as UserRef)?.email}
                    </AppText>
                  </View>
                  <RiskBadge level={r.overallRisk} score={r.score} />
                </Card>
              ))
            )}
            <SectionHeader title="Critical notifications" icon="alert-circle-outline" />
            {alerts.data.critical.length === 0 ? (
              <Card>
                <AppText tone="faint">No critical notifications this week.</AppText>
              </Card>
            ) : (
              alerts.data.critical.slice(0, 20).map((n) => (
                <Card key={n._id} accent={colors.danger}>
                  <AppText weight="700">{n.title}</AppText>
                  <AppText variant="caption" tone="faint">
                    to {fullName(n.userId as UserRef)} · {formatDateTime(n.createdAt)}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {n.message}
                  </AppText>
                </Card>
              ))
            )}
            <SectionHeader title="AI preventive alerts" icon="sparkles-outline" />
            {alerts.data.aiAlerts.slice(0, 20).map((a) => (
              <Card key={a._id}>
                <AppText weight="700">{a.title}</AppText>
                <AppText variant="caption" tone="faint">
                  {fullName(a.patientUserId as UserRef)} · {a.date} · {a.severity}
                  {a.probability != null ? ` · ${Math.round(a.probability * 100)}%` : ''} · outcome {a.outcome}
                </AppText>
              </Card>
            ))}
          </>
        ) : null
      ) : (
        <>
          <View style={screenStyles.row}>
            <View style={screenStyles.flex}>
              <SelectField label="Type" value={type} options={typeOptions} onChange={setType} />
            </View>
            <View style={screenStyles.flex}>
              <SelectField label="Delivery" value={failed} options={[{ value: '', label: 'All' }, { value: 'true', label: 'Failed deliveries' }]} onChange={setFailed} />
            </View>
          </View>
          {log.isPending ? (
            <LoadingState />
          ) : log.isError ? (
            <ErrorState error={log.error} onRetry={log.refetch} />
          ) : items.length === 0 ? (
            <Card>
              <AppText tone="faint">No notifications match.</AppText>
            </Card>
          ) : (
            <>
              {items.map((n) => (
                <Card key={n._id} accent={n.priority === 'critical' ? colors.danger : n.priority === 'high' ? colors.orange : undefined}>
                  <View style={screenStyles.row}>
                    <View style={screenStyles.flex}>
                      <AppText weight="700">{n.title}</AppText>
                      <AppText variant="caption" tone="faint">
                        to {fullName(n.userId as UserRef)} ({(n.userId as UserRef)?.role}) · {formatDateTime(n.createdAt)} · {n.isRead ? 'read' : 'unread'}
                      </AppText>
                    </View>
                    <IconButton icon="trash-outline" color={colors.danger} accessibilityLabel="Delete notification" onPress={() => remove.mutate(n._id)} />
                  </View>
                  <View style={screenStyles.wrap}>
                    <Pill label={n.type.replace(/_/g, ' ')} color={colors.textFaint} />
                    {n.broadcastId ? <Pill label="broadcast" color={colors.purple} /> : null}
                  </View>
                  <DeliveryPills deliveries={n.deliveries ?? []} />
                </Card>
              ))}
              {log.hasNextPage ? <Button title="Load more" variant="secondary" onPress={() => log.fetchNextPage()} loading={log.isFetchingNextPage} /> : null}
            </>
          )}
        </>
      )}

      <Sheet
        visible={bcOpen}
        onClose={() => setBcOpen(false)}
        title="Broadcast notification"
        footer={
          <>
            <Button title="Cancel" variant="secondary" onPress={() => setBcOpen(false)} style={screenStyles.flex} />
            <Button title="Send" icon="send-outline" disabled={!bc.title.trim() || !bc.message.trim() || bc.roles.length === 0} loading={broadcast.isPending} onPress={() => broadcast.mutate()} style={screenStyles.flex} />
          </>
        }
      >
        <TextField label="Title" required value={bc.title} onChangeText={(v) => setBc((b) => ({ ...b, title: v }))} placeholder="Scheduled maintenance" />
        <TextField label="Message" required value={bc.message} onChangeText={(v) => setBc((b) => ({ ...b, message: v }))} multiline />
        <ChipGroup label="Recipients" multiple options={[{ value: 'patient', label: 'Patients' }, { value: 'caregiver', label: 'Caregivers' }, { value: 'doctor', label: 'Doctors' }, { value: 'admin', label: 'Admins' }]} selected={bc.roles} onToggle={(r: Role) => setBc((b) => ({ ...b, roles: b.roles.includes(r) ? b.roles.filter((x) => x !== r) : [...b.roles, r] }))} />
        <SelectField label="Priority" value={bc.priority} options={[{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }]} onChange={(v) => setBc((b) => ({ ...b, priority: v }))} />
        <SelectField label="Channels" value={bc.channel} options={[{ value: 'in_app', label: 'In-app only' }, { value: 'both', label: 'In-app + email' }, { value: 'all', label: 'Every channel (push, SMS for urgent)' }]} onChange={(v) => setBc((b) => ({ ...b, channel: v }))} />
      </Sheet>
    </Screen>
  );
}
