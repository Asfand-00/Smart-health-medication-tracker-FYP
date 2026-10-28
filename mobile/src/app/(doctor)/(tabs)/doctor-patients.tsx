/**
 * Doctor's patients — GET /doctor/patients with live adherence and risk.
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
import { Avatar, Card, Pill } from '../../../components/ui/Card';
import { Screen, screenStyles } from '../../../components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import { useTheme } from '../../../context/AccessibilityContext';
import { useToast } from '../../../context/ToastContext';
import { confirmAction } from '../../../utils/confirm';
import { formatDateOnly } from '../../../utils/format';

export default function DoctorPatients() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const patients = useQuery({ queryKey: qk.doctorPatients, queryFn: doctorApi.patients });
  const remove = useMutation({
    mutationFn: doctorApi.removePatient,
    onSuccess: () => {
      toast.success('Patient removed.');
      queryClient.invalidateQueries({ queryKey: ['doctor'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Screen onRefresh={() => patients.refetch()}>
      {patients.isPending ? (
        <LoadingState label="Loading patients…" />
      ) : patients.isError ? (
        <ErrorState error={patients.error} onRetry={patients.refetch} />
      ) : (patients.data ?? []).length === 0 ? (
        <EmptyState icon="people-outline" title="No patients yet" message="Accept patient requests from the Dashboard tab." />
      ) : (
        patients.data!.map((p) => (
          <Card key={p.patientId}>
            <View style={[screenStyles.row, { alignItems: 'center' }]}>
              <Avatar text={`${p.firstName[0] ?? ''}${p.lastName[0] ?? ''}`} />
              <View style={screenStyles.flex}>
                <AppText weight="700">
                  {p.firstName} {p.lastName}
                </AppText>
                <AppText variant="caption" tone="faint">
                  {p.email} · born {formatDateOnly(p.dateOfBirth)}
                </AppText>
              </View>
              <RiskBadge level={p.riskLevel} score={p.riskScore} />
            </View>
            <View style={screenStyles.wrap}>
              <Pill label={`Today ${p.todayAdherence}%`} color={p.todayAdherence >= 80 ? colors.success : colors.warning} />
              <Pill label={`Week ${p.weeklyAdherence}%`} color={p.weeklyAdherence >= 80 ? colors.success : colors.warning} />
              <Pill label={`${p.medicationCount} meds`} color={colors.primary} />
              {p.pendingPrescriptions > 0 ? <Pill label={`${p.pendingPrescriptions} Rx to verify`} color={colors.orange} /> : null}
            </View>
            <Button title="Open overview" icon="open-outline" onPress={() => router.push({ pathname: '/doctor-patient/[id]', params: { id: p.patientId, name: `${p.firstName} ${p.lastName}` } })} />
            <Button
              title="End supervision"
              icon="person-remove-outline"
              variant="ghost"
              onPress={async () => {
                if (await confirmAction('End supervision', `Stop supervising ${p.firstName}? They can send a new request later.`, 'End')) remove.mutate(p.patientId);
              }}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}
