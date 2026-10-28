/**
 * Caregiver overview — port of pages/dashboards/CaregiverDashboard.jsx.
 *  - live missed-medication alerts from the socket, with "Poke patient"
 *  - patients under care (GET /caregiver/patients) → tap for records
 *  - poke (POST /reminders/poke) and remove (DELETE /caregiver/patients/:id)
 *  - pending connection requests (GET /caregiver/requests) accept / decline
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { errorMessage } from '../../../api/client';
import { qk } from '../../../api/queryClient';
import { caregiverApi, reminderApi } from '../../../api/services';
import { AppText } from '../../../components/ui/AppText';
import { Button, IconButton } from '../../../components/ui/Button';
import { Avatar, Card, SectionHeader } from '../../../components/ui/Card';
import { Screen, screenStyles } from '../../../components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import { useTheme } from '../../../context/AccessibilityContext';
import { useCurrentUser } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import { useToast } from '../../../context/ToastContext';
import { confirmAction } from '../../../utils/confirm';
import { formatTime, fullName, initials } from '../../../utils/format';

export default function CaregiverOverview() {
  const user = useCurrentUser();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { missedAlerts, dismissMissedAlert } = useSocket();
  const [pokingId, setPokingId] = useState<string | null>(null);

  const patients = useQuery({ queryKey: qk.caregiverPatients, queryFn: caregiverApi.getPatients });
  const requests = useQuery({ queryKey: qk.caregiverRequests, queryFn: caregiverApi.getCaregiverRequests });

  const handle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'accepted' | 'declined' }) => caregiverApi.handleRequest(id, status),
    onSuccess: (_d, { status }) => {
      toast.success(`Request ${status} successfully!`);
      queryClient.invalidateQueries({ queryKey: ['caregiver'] });
    },
    onError: (e, { status }) => toast.error(errorMessage(e) || `Failed to ${status} request`),
  });

  const remove = useMutation({
    mutationFn: caregiverApi.removePatient,
    onSuccess: () => {
      toast.success('Patient removed from your care list.');
      queryClient.invalidateQueries({ queryKey: ['caregiver'] });
    },
    onError: (e) => toast.error(errorMessage(e) || 'Failed to remove patient.'),
  });

  const poke = async (patientUserId: string, name: string) => {
    setPokingId(patientUserId);
    try {
      await reminderApi.poke(patientUserId);
      toast.success(`Poke sent to ${name}! 👋`);
    } catch (e) {
      toast.error(errorMessage(e) || 'Failed to send poke');
    } finally {
      setPokingId(null);
    }
  };

  const refresh = () => Promise.all([patients.refetch(), requests.refetch()]);
  const list = (patients.data ?? []).filter((p) => p.userId && p.userId._id);
  const pending = (requests.data ?? []).filter((r) => r.patientId);

  return (
    <Screen onRefresh={refresh}>
      <Card>
        <AppText variant="title">Welcome, {user.firstName}! 🤝</AppText>
        <AppText tone="muted">
          {pending.length} pending request{pending.length === 1 ? '' : 's'} · {list.length} patient{list.length === 1 ? '' : 's'} under care.
        </AppText>
      </Card>

      {missedAlerts.length > 0 && (
        <View style={screenStyles.gap}>
          <SectionHeader title="⚠️ Missed medication alerts" />
          {missedAlerts.map((a) => (
            <Card key={a.id} accent={colors.danger}>
              <View style={screenStyles.row}>
                <View style={screenStyles.flex}>
                  <AppText weight="700">
                    {a.patientName} missed {a.medicationName}
                  </AppText>
                  <AppText variant="caption" tone="faint">
                    {a.timeOfDay} · {formatTime(a.timestamp)}
                  </AppText>
                </View>
                <IconButton icon="close" accessibilityLabel="Dismiss alert" onPress={() => dismissMissedAlert(a.id)} />
              </View>
              <Button title="Poke patient" icon="flash-outline" variant="warning" loading={pokingId === a.patientId} onPress={() => poke(a.patientId, a.patientName)} />
            </Card>
          ))}
        </View>
      )}

      <SectionHeader title="Patients under care" icon="people-outline" />
      {patients.isPending ? (
        <LoadingState />
      ) : patients.isError ? (
        <ErrorState error={patients.error} onRetry={patients.refetch} />
      ) : list.length === 0 ? (
        <EmptyState icon="people-outline" title="No assigned patients yet" message="Patients appear here after you accept their care request." />
      ) : (
        list.map((p) => {
          const u = p.userId!;
          return (
            <Card key={u._id}>
              <View style={[screenStyles.row, { alignItems: 'center' }]}>
                <Avatar text={initials(u)} color="#7e22ce" />
                <View style={screenStyles.flex}>
                  <AppText weight="700">{fullName(u)}</AppText>
                  <AppText variant="caption" tone="faint">{u.email}</AppText>
                </View>
              </View>
              <Button
                title="View records & medications"
                icon="folder-open-outline"
                accessibilityLabel={`View records and medications for ${fullName(u)}`}
                onPress={() => router.push({ pathname: '/patient/[id]', params: { id: u._id, name: fullName(u) } })}
              />
              <View style={screenStyles.row}>
                <Button
                  title="Poke"
                  icon="flash-outline"
                  variant="warning"
                  loading={pokingId === u._id}
                  onPress={() => poke(u._id, u.firstName)}
                  style={screenStyles.flex}
                  accessibilityLabel={`Poke ${fullName(u)}`}
                />
                <Button
                  title="Remove"
                  icon="person-remove-outline"
                  variant="danger"
                  onPress={async () => {
                    if (await confirmAction('Remove patient', `Are you sure you want to remove ${u.firstName} from your care list?`, 'Remove')) {
                      remove.mutate(u._id);
                    }
                  }}
                  style={screenStyles.flex}
                  accessibilityLabel={`Remove ${fullName(u)} from care list`}
                />
              </View>
            </Card>
          );
        })
      )}

      <SectionHeader title="Connection requests" icon="time-outline" />
      {requests.isPending ? (
        <LoadingState />
      ) : requests.isError ? (
        <ErrorState error={requests.error} onRetry={requests.refetch} />
      ) : pending.length === 0 ? (
        <Card>
          <AppText tone="faint">No pending requests.</AppText>
        </Card>
      ) : (
        pending.map((r) => {
          const busy = handle.isPending && handle.variables?.id === r._id;
          return (
            <Card key={r._id}>
              <View style={[screenStyles.row, { alignItems: 'center' }]}>
                <Avatar text={initials(r.patientId)} />
                <View style={screenStyles.flex}>
                  <AppText weight="700">{fullName(r.patientId)}</AppText>
                  <AppText variant="caption" tone="faint">{r.patientId?.email}</AppText>
                </View>
              </View>
              <View style={screenStyles.row}>
                <Button title="Decline" icon="close" variant="secondary" disabled={busy} onPress={() => handle.mutate({ id: r._id, status: 'declined' })} style={screenStyles.flex} />
                <Button title="Accept" icon="checkmark" variant="success" loading={busy} onPress={() => handle.mutate({ id: r._id, status: 'accepted' })} style={screenStyles.flex} />
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
