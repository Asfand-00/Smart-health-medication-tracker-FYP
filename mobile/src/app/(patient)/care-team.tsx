/**
 * Care team — port of pages/dashboards/CareTeamPage.jsx.
 * "My team" (assigned caregivers) and "Find caregiver" (all active caregivers
 * with request status: already in team / pending / declined / send request).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { errorMessage } from '../../api/client';
import { qk } from '../../api/queryClient';
import { caregiverApi } from '../../api/services';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Avatar, Card, Pill } from '../../components/ui/Card';
import { SegmentedControl } from '../../components/ui/Form';
import { Screen, screenStyles } from '../../components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { useTheme } from '../../context/AccessibilityContext';
import { useToast } from '../../context/ToastContext';
import { fullName, initials } from '../../utils/format';

async function loadCareTeam() {
  const [team, available, requests] = await Promise.all([
    caregiverApi.getMyTeam(),
    caregiverApi.getAvailableCaregivers(),
    caregiverApi.getPatientRequests(),
  ]);
  return { team, available, requests };
}

export default function CareTeamScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'team' | 'find'>('team');
  const data = useQuery({ queryKey: qk.careTeam, queryFn: loadCareTeam });

  const request = useMutation({
    mutationFn: caregiverApi.requestCaregiver,
    onSuccess: () => {
      toast.success('Request sent successfully!');
      queryClient.invalidateQueries({ queryKey: qk.careTeam });
    },
    onError: (e) => toast.error(errorMessage(e) || 'Failed to send request'),
  });

  if (data.isPending) return <LoadingState label="Loading care team…" />;
  if (data.isError && !data.data) return <ErrorState error={data.error} onRetry={data.refetch} />;
  const { team, available, requests } = data.data!;
  const statusOf = (id: string) => requests.find((r) => r.caregiverId?._id === id)?.status ?? null;

  return (
    <Screen onRefresh={() => data.refetch()}>
      <AppText tone="muted">Manage the people who can view and manage your health records.</AppText>
      <SegmentedControl
        value={view}
        onChange={setView}
        options={[
          { value: 'team', label: `My team (${team.length})` },
          { value: 'find', label: 'Find caregiver' },
        ]}
      />

      {view === 'team' ? (
        team.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No caregivers assigned"
            message="Finding a caregiver allows them to monitor your medications and vitals."
            action={<Button title="Find caregiver" icon="person-add-outline" onPress={() => setView('find')} />}
          />
        ) : (
          team.map((c) => (
            <Card key={c._id}>
              <View style={[screenStyles.row, { alignItems: 'center' }]}>
                <Avatar text={initials(c)} color="#7e22ce" />
                <View style={screenStyles.flex}>
                  <AppText weight="700">{fullName(c)}</AppText>
                  <AppText variant="caption" tone="faint">{c.email}</AppText>
                  {c.phone ? <AppText variant="caption" tone="faint">{c.phone}</AppText> : null}
                </View>
              </View>
              {c.phone ? <Button title={`Call ${c.firstName}`} icon="call-outline" variant="secondary" onPress={() => Linking.openURL(`tel:${c.phone}`)} /> : null}
            </Card>
          ))
        )
      ) : available.length === 0 ? (
        <EmptyState icon="search-outline" title="No caregivers available at the moment" />
      ) : (
        available.map((c) => {
          const inTeam = team.some((t) => t._id === c._id);
          const status = statusOf(c._id);
          return (
            <Card key={c._id}>
              <View style={[screenStyles.row, { alignItems: 'center' }]}>
                <Avatar text={initials(c)} color="#7e22ce" />
                <View style={screenStyles.flex}>
                  <AppText weight="700">{fullName(c)}</AppText>
                  <AppText variant="caption" tone="faint">{c.email}</AppText>
                </View>
              </View>
              {inTeam ? (
                <Pill label="Already in team" color={colors.success} />
              ) : status === 'pending' ? (
                <Pill label="Request pending" color={colors.warning} />
              ) : status === 'declined' ? (
                <Pill label="Request declined" color={colors.danger} />
              ) : (
                <Button
                  title="Send request"
                  icon="paper-plane-outline"
                  onPress={() => request.mutate(c._id)}
                  loading={request.isPending && request.variables === c._id}
                  accessibilityLabel={`Send care request to ${fullName(c)}`}
                />
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}
