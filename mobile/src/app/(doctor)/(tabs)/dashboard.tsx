/**
 * Doctor dashboard — GET /doctor/dashboard: patients, pending work
 * (requests, prescriptions to verify, plan approvals), high-risk patients,
 * average adherence; plus the incoming patient requests to accept/decline.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { errorMessage } from '../../../api/client';
import { qk } from '../../../api/queryClient';
import { doctorApi } from '../../../api/services';
import { RiskBadge } from '../../../components/RiskBadge';
import { AppText } from '../../../components/ui/AppText';
import { Button } from '../../../components/ui/Button';
import { Avatar, Card, ListItem, SectionHeader, StatTile } from '../../../components/ui/Card';
import { Screen, screenStyles } from '../../../components/ui/Screen';
import { ErrorState, LoadingState } from '../../../components/ui/States';
import { useTheme } from '../../../context/AccessibilityContext';
import { useCurrentUser } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import type { UserRef } from '../../../types/models';
import { formatDateTime, fullName, initials } from '../../../utils/format';

export default function DoctorDashboard() {
  const user = useCurrentUser();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const dash = useQuery({ queryKey: qk.doctorDashboard, queryFn: doctorApi.dashboard });
  const requests = useQuery({ queryKey: qk.doctorRequests, queryFn: doctorApi.requests });

  const handle = useMutation({
    mutationFn: (v: { id: string; status: 'accepted' | 'declined' }) => doctorApi.handleRequest(v.id, v.status),
    onSuccess: (_d, v) => {
      toast.success(`Request ${v.status}.`);
      queryClient.invalidateQueries({ queryKey: ['doctor'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const d = dash.data;
  return (
    <Screen onRefresh={() => Promise.all([dash.refetch(), requests.refetch()])}>
      <Card>
        <AppText variant="title">
          Dr. {user.firstName} {user.lastName}
        </AppText>
        <AppText tone="muted">{user.speciality ? `${user.speciality} · ` : ''}Remote supervision of medication adherence.</AppText>
      </Card>

      {dash.isPending ? (
        <LoadingState />
      ) : dash.isError ? (
        <ErrorState error={dash.error} onRetry={dash.refetch} />
      ) : d ? (
        <>
          <View style={screenStyles.wrap}>
            <StatTile label="Patients" value={d.totalPatients} icon="people-outline" color={colors.primary} />
            <StatTile label="Avg weekly adherence" value={`${d.averageWeeklyAdherence}%`} icon="trending-up-outline" color={colors.teal} />
            <StatTile label="Prescriptions to verify" value={d.pendingPrescriptions} icon="document-attach-outline" color={colors.warning} />
            <StatTile label="Plan approvals" value={d.pendingPlanApprovals} icon="checkmark-done-outline" color={colors.purple} />
          </View>
          <Card>
            <ListItem title="Verify prescriptions" subtitle={`${d.pendingPrescriptions} waiting`} icon="document-attach-outline" onPress={() => router.navigate('/doctor-prescriptions')} />
            <ListItem title="Review plan changes" subtitle={`${d.pendingPlanApprovals} waiting`} icon="checkmark-done-outline" onPress={() => router.navigate('/approvals')} />
            <ListItem title="Notifications" subtitle={`${d.unreadAlerts} unread`} icon="notifications-outline" onPress={() => router.push('/notifications')} />
          </Card>

          <SectionHeader title="High-risk patients" icon="warning-outline" />
          {d.highRiskPatients.length === 0 ? (
            <Card>
              <AppText tone="faint">No patient is currently rated high or critical risk.</AppText>
            </Card>
          ) : (
            d.highRiskPatients.map((p) => (
              <Card key={p.patientId} accent={colors.danger}>
                <View style={[screenStyles.row, { alignItems: 'center' }]}>
                  <AppText weight="700" style={screenStyles.flex}>
                    {p.name}
                  </AppText>
                  <RiskBadge level={p.risk} score={p.score} />
                </View>
                <Button title="Open overview" icon="open-outline" variant="secondary" onPress={() => router.push({ pathname: '/doctor-patient/[id]', params: { id: p.patientId, name: p.name } })} />
              </Card>
            ))
          )}
        </>
      ) : null}

      <SectionHeader title="Patient requests" icon="person-add-outline" />
      {requests.isPending ? (
        <LoadingState />
      ) : (requests.data ?? []).length === 0 ? (
        <Card>
          <AppText tone="faint">No pending requests. Patients find you under Care team → Find doctor.</AppText>
        </Card>
      ) : (
        requests.data!.map((r) => {
          const p = r.patientUserId as UserRef;
          const busy = handle.isPending && handle.variables?.id === r._id;
          return (
            <Card key={r._id}>
              <View style={[screenStyles.row, { alignItems: 'center' }]}>
                <Avatar text={initials(p)} />
                <View style={screenStyles.flex}>
                  <AppText weight="700">{fullName(p)}</AppText>
                  <AppText variant="caption" tone="faint">
                    {p?.email} · {formatDateTime(r.createdAt)}
                  </AppText>
                </View>
              </View>
              {r.message ? <AppText tone="muted">"{r.message}"</AppText> : null}
              <View style={screenStyles.row}>
                <Button title="Decline" icon="close" variant="secondary" disabled={busy} onPress={() => handle.mutate({ id: r._id, status: 'declined' })} style={screenStyles.flex} />
                <Button title="Accept" icon="checkmark" variant="success" loading={busy} onPress={() => handle.mutate({ id: r._id, status: 'accepted' })} style={screenStyles.flex} />
              </View>
            </Card>
          );
        })
      )}

      {d && d.recentNotes.length > 0 ? (
        <>
          <SectionHeader title="Recent notes" icon="create-outline" />
          <Card>
            {d.recentNotes.map((n) => (
              <ListItem key={n._id} title={n.title} subtitle={`${fullName(n.patientUserId as UserRef)} · ${formatDateTime(n.createdAt)}`} icon="document-text-outline" onPress={() => router.push({ pathname: '/doctor-patient/[id]', params: { id: (n.patientUserId as UserRef)?._id } })} />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
