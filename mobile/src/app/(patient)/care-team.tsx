/**
 * Care team — caregivers (GET /caregiver/*) and doctors (GET /doctor/*):
 * "My team", "Find caregiver", "Find doctor" with request status.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { errorMessage } from '../../api/client';
import { qk } from '../../api/queryClient';
import { caregiverApi, doctorApi } from '../../api/services';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Avatar, Card, Pill, SectionHeader } from '../../components/ui/Card';
import { SegmentedControl, TextField } from '../../components/ui/Form';
import { Screen, screenStyles } from '../../components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { useTheme } from '../../context/AccessibilityContext';
import { useToast } from '../../context/ToastContext';
import type { DoctorRef } from '../../types/models';
import { fullName, initials } from '../../utils/format';

async function loadCareTeam() {
  const [team, available, requests, doctors, availableDoctors, doctorRequests] = await Promise.all([
    caregiverApi.getMyTeam(),
    caregiverApi.getAvailableCaregivers(),
    caregiverApi.getPatientRequests(),
    doctorApi.myDoctors(),
    doctorApi.available(),
    doctorApi.myRequests(),
  ]);
  return { team, available, requests, doctors, availableDoctors, doctorRequests };
}

export default function CareTeamScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'team' | 'find' | 'doctor'>('team');
  const [message, setMessage] = useState('');
  const data = useQuery({ queryKey: qk.careTeam, queryFn: loadCareTeam });

  const request = useMutation({
    mutationFn: caregiverApi.requestCaregiver,
    onSuccess: () => {
      toast.success('Request sent successfully!');
      queryClient.invalidateQueries({ queryKey: qk.careTeam });
    },
    onError: (e) => toast.error(errorMessage(e) || 'Failed to send request'),
  });
  const requestDoctor = useMutation({
    mutationFn: (doctorId: string) => doctorApi.request(doctorId, message.trim() || undefined),
    onSuccess: () => {
      toast.success('Request sent to the doctor.');
      setMessage('');
      queryClient.invalidateQueries({ queryKey: qk.careTeam });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (data.isPending) return <LoadingState label="Loading care team…" />;
  if (data.isError && !data.data) return <ErrorState error={data.error} onRetry={data.refetch} />;
  const { team, available, requests, doctors, availableDoctors, doctorRequests } = data.data!;
  const statusOf = (id: string) => requests.find((r) => r.caregiverId?._id === id)?.status ?? null;
  const doctorStatusOf = (id: string) => doctorRequests.find((r) => (r.doctorId as DoctorRef)?._id === id && r.status !== 'ended')?.status ?? null;

  const personCard = (p: DoctorRef, color: string, footer: React.ReactNode) => (
    <Card key={p._id}>
      <View style={[screenStyles.row, { alignItems: 'center' }]}>
        <Avatar text={initials(p)} color={color} />
        <View style={screenStyles.flex}>
          <AppText weight="700">{fullName(p)}</AppText>
          <AppText variant="caption" tone="faint">
            {p.email}
            {p.speciality ? ` · ${p.speciality}` : ''}
          </AppText>
          {p.phone ? (
            <AppText variant="caption" tone="faint">
              {p.phone}
            </AppText>
          ) : null}
        </View>
      </View>
      {footer}
    </Card>
  );

  return (
    <Screen onRefresh={() => data.refetch()}>
      <AppText tone="muted">Caregivers and doctors who can view your records, approve plan changes and verify prescriptions.</AppText>
      <SegmentedControl
        value={view}
        onChange={setView}
        options={[
          { value: 'team', label: `My team (${team.length + doctors.length})` },
          { value: 'find', label: 'Find caregiver' },
          { value: 'doctor', label: 'Find doctor' },
        ]}
      />

      {view === 'team' ? (
        <>
          <SectionHeader title="Caregivers" icon="people-outline" />
          {team.length === 0 ? (
            <EmptyState icon="people-outline" title="No caregivers assigned" message="A caregiver can monitor your medications and vitals." action={<Button title="Find caregiver" icon="person-add-outline" onPress={() => setView('find')} />} />
          ) : (
            team.map((c) => personCard(c, '#7e22ce', c.phone ? <Button title={`Call ${c.firstName}`} icon="call-outline" variant="secondary" onPress={() => Linking.openURL(`tel:${c.phone}`)} /> : null))
          )}
          <SectionHeader title="Doctors" icon="medkit-outline" />
          {doctors.length === 0 ? (
            <EmptyState icon="medkit-outline" title="No doctor linked" message="A doctor can verify prescriptions, approve plan changes and see your adherence." action={<Button title="Find doctor" icon="person-add-outline" onPress={() => setView('doctor')} />} />
          ) : (
            doctors.map((d) => personCard(d, '#0f766e', <Pill label="Supervising your plan" color={colors.teal} />))
          )}
        </>
      ) : view === 'find' ? (
        available.length === 0 ? (
          <EmptyState icon="search-outline" title="No caregivers available at the moment" />
        ) : (
          available.map((c) => {
            const inTeam = team.some((t) => t._id === c._id);
            const status = statusOf(c._id);
            return personCard(
              c,
              '#7e22ce',
              inTeam ? <Pill label="Already in team" color={colors.success} /> : status === 'pending' ? <Pill label="Request pending" color={colors.warning} /> : status === 'declined' ? <Pill label="Request declined" color={colors.danger} /> : <Button title="Send request" icon="paper-plane-outline" onPress={() => request.mutate(c._id)} loading={request.isPending && request.variables === c._id} accessibilityLabel={`Send care request to ${fullName(c)}`} />,
            );
          })
        )
      ) : availableDoctors.length === 0 ? (
        <EmptyState icon="search-outline" title="No doctors registered yet" />
      ) : (
        <>
          <TextField label="Message to the doctor (optional)" value={message} onChangeText={setMessage} placeholder="e.g. Please supervise my Alzheimer's medication plan" />
          {availableDoctors.map((d) => {
            const linked = doctors.some((x) => x._id === d._id);
            const status = doctorStatusOf(d._id);
            return personCard(
              d,
              '#0f766e',
              linked ? <Pill label="Your doctor" color={colors.success} /> : status === 'pending' ? <Pill label="Request pending" color={colors.warning} /> : status === 'declined' ? <Pill label="Request declined" color={colors.danger} /> : <Button title="Request supervision" icon="paper-plane-outline" onPress={() => requestDoctor.mutate(d._id)} loading={requestDoctor.isPending && requestDoctor.variables === d._id} accessibilityLabel={`Request Dr. ${fullName(d)}`} />,
            );
          })}
        </>
      )}
    </Screen>
  );
}
