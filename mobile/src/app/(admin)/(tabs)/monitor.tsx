/**
 * System monitoring — GET /admin/dashboard: users, activity, notification
 * delivery, security counters, server/database health, scheduler state, and
 * on-demand background jobs.
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { errorMessage } from '../../../api/client';
import { qk } from '../../../api/queryClient';
import { adminApi } from '../../../api/services';
import { AppText } from '../../../components/ui/AppText';
import { Button } from '../../../components/ui/Button';
import { Card, KeyValue, ListItem, Pill, SectionHeader, StatTile } from '../../../components/ui/Card';
import { Screen, screenStyles } from '../../../components/ui/Screen';
import { ErrorState, LoadingState } from '../../../components/ui/States';
import { useTheme } from '../../../context/AccessibilityContext';
import { useAuth, useCurrentUser } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { confirmAction } from '../../../utils/confirm';
import { formatDateTime } from '../../../utils/format';

const JOBS = [
  { name: 'generate-reminders', label: 'Generate today\'s reminders' },
  { name: 'escalate-reminders', label: 'Run escalation check' },
  { name: 'ai-alerts', label: 'Run AI preventive alerts' },
  { name: 'recalculate-risk', label: 'Recalculate risk scores' },
  { name: 'expire-prescriptions', label: 'Expire old prescriptions' },
];

const uptime = (s: number) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

export default function AdminMonitor() {
  const me = useCurrentUser();
  const { logout } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const dash = useQuery({ queryKey: qk.adminDashboard, queryFn: adminApi.dashboard, refetchInterval: 30_000 });
  const job = useMutation({
    mutationFn: adminApi.runJob,
    onSuccess: (r, name) => {
      toast.success(`Job ${name} finished${r ? `: ${JSON.stringify(r).slice(0, 80)}` : ''}`);
      dash.refetch();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const d = dash.data;
  const sched = (d?.system.scheduler ?? {}) as Record<string, string | null | number>;

  return (
    <Screen onRefresh={() => dash.refetch()}>
      <Card>
        <AppText variant="title">System overview ⚙️</AppText>
        <AppText variant="caption" tone="faint">
          Signed in as {me.email}
        </AppText>
      </Card>
      {dash.isPending ? (
        <LoadingState />
      ) : dash.isError ? (
        <ErrorState error={dash.error} onRetry={dash.refetch} />
      ) : d ? (
        <>
          <Card accent={d.system.status === 'healthy' ? colors.success : colors.danger}>
            <View style={screenStyles.row}>
              <AppText variant="heading" style={screenStyles.flex}>
                Server {d.system.status}
              </AppText>
              <Pill label={d.security.maintenanceMode ? 'MAINTENANCE MODE' : 'serving'} color={d.security.maintenanceMode ? colors.danger : colors.success} />
            </View>
            <KeyValue label="Uptime" value={`${uptime(d.system.uptimeSeconds)} (since ${formatDateTime(d.system.startedAt)})`} />
            <KeyValue label="Database" value={`${d.system.database.state} · ${d.system.database.collections ?? '?'} collections · ${d.system.database.dataSizeMb ?? '?'} MB`} />
            <KeyValue label="Memory" value={`${d.system.memory.heapUsedMb} / ${d.system.memory.heapTotalMb} MB heap · ${d.system.memory.rssMb} MB RSS`} />
            <KeyValue label="Runtime" value={`Node ${d.system.nodeVersion} · ${d.system.environment}`} />
            <KeyValue label="Live sockets" value={String(d.system.socketConnections)} />
            <KeyValue label="Channels" value={`email ${d.system.channels.email ? 'on' : 'mock'} · sms ${d.system.channels.sms ? 'on' : 'mock'} · push on`} />
          </Card>

          <SectionHeader title="Users" icon="people-outline" />
          <View style={screenStyles.wrap}>
            <StatTile label="Total users" value={d.users.total} sub={`${d.users.inactive} inactive`} icon="people-outline" color={colors.primary} />
            <StatTile label="Active today" value={d.users.activeToday} sub={`${d.users.newThisWeek} new this week`} icon="log-in-outline" color={colors.teal} />
            <StatTile label="Patients" value={d.users.byRole.patient ?? 0} icon="pulse-outline" color={colors.success} />
            <StatTile label="Caregivers / doctors" value={`${d.users.byRole.caregiver ?? 0} / ${d.users.byRole.doctor ?? 0}`} icon="medkit-outline" color={colors.purple} />
          </View>

          <SectionHeader title="Today's activity" icon="pulse-outline" />
          <View style={screenStyles.wrap}>
            <StatTile label="Doses logged" value={d.activity.dosesToday} sub={`${d.activity.takenToday} taken · ${d.activity.missedToday} missed`} icon="checkmark-done-outline" color={colors.success} />
            <StatTile label="High-risk patients" value={d.activity.highRiskPatients} icon="warning-outline" color={colors.danger} />
            <StatTile label="Rx pending" value={d.activity.prescriptionsPending} sub="to verify" icon="document-attach-outline" color={colors.warning} />
            <StatTile label="AI alerts 24h" value={d.activity.aiAlerts24h} icon="sparkles-outline" color={colors.orange} />
          </View>

          <SectionHeader title="Notifications & security" icon="shield-outline" />
          <View style={screenStyles.wrap}>
            <StatTile label="Sent 24h" value={d.notifications.last24h} sub={`${d.notifications.failedDeliveries24h} failed deliveries`} icon="notifications-outline" color={colors.primary} />
            <StatTile label="Push devices" value={d.notifications.pushDevices} icon="phone-portrait-outline" color={colors.teal} />
            <StatTile label="Failed logins 24h" value={d.security.failedLogins24h} icon="lock-closed-outline" color={colors.danger} />
            <StatTile label="Denied requests 24h" value={d.security.deniedRequests24h} icon="ban-outline" color={colors.orange} />
          </View>
          <Card>
            <ListItem title="Access logs & audit trail" subtitle="Every sign-in and data change" icon="list-outline" onPress={() => router.push('/audit')} />
          </Card>

          <SectionHeader title="Scheduler" icon="time-outline" />
          <Card>
            <KeyValue label="Last tick" value={sched.lastTickAt ? formatDateTime(String(sched.lastTickAt)) : 'not yet'} />
            <KeyValue label="Reminders generated" value={sched.lastReminderRunAt ? `${formatDateTime(String(sched.lastReminderRunAt))} · ${sched.remindersGeneratedToday ?? 0} today` : 'not yet'} />
            <KeyValue label="Escalation run" value={sched.lastEscalationRunAt ? formatDateTime(String(sched.lastEscalationRunAt)) : 'not yet'} />
            <KeyValue label="AI alert run" value={sched.lastAiRunAt ? formatDateTime(String(sched.lastAiRunAt)) : 'not yet (hourly)'} />
            {sched.lastError ? (
              <AppText variant="caption" color={colors.danger}>
                Last error: {String(sched.lastError)}
              </AppText>
            ) : null}
            {JOBS.map((j) => (
              <Button key={j.name} title={j.label} icon="play-outline" variant="secondary" onPress={() => job.mutate(j.name)} loading={job.isPending && job.variables === j.name} />
            ))}
          </Card>
        </>
      ) : null}

      <Card>
        <ListItem title="Notifications" icon="notifications-outline" onPress={() => router.push('/notifications')} />
        <ListItem title="My profile" icon="person-outline" onPress={() => router.push('/profile')} />
        <ListItem title="Settings" icon="settings-outline" onPress={() => router.push('/settings')} />
        <ListItem title="Sign out" icon="log-out-outline" destructive onPress={async () => { if (await confirmAction('Sign out', 'Are you sure you want to sign out?', 'Sign out')) await logout(); }} />
      </Card>
    </Screen>
  );
}
