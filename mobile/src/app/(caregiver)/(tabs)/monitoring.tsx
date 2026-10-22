/**
 * Patient monitoring — port of pages/CaregiverMonitoringPage.jsx.
 *  - patient picker (GET /caregiver-dashboard/overview) with adherence + risk
 *  - today's schedule with Administered / Skipped (POST /adherence/confirm)
 *  - 14-day activity timeline
 *  - log behavioural observation, add emergency contact (bottom sheets)
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { errorMessage } from '../../../api/client';
import { qk } from '../../../api/queryClient';
import { adherenceApi, caregiverDashboardApi } from '../../../api/services';
import { PatientSelector, useCaregiverPatients } from '../../../components/PatientSelector';
import { RiskBadge } from '../../../components/RiskBadge';
import { TimelineList } from '../../../components/TimelineList';
import { AppText } from '../../../components/ui/AppText';
import { Button } from '../../../components/ui/Button';
import { Card, Pill, SectionHeader } from '../../../components/ui/Card';
import { SelectField, TextField } from '../../../components/ui/Form';
import { Screen, screenStyles } from '../../../components/ui/Screen';
import { Sheet } from '../../../components/ui/Sheet';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import { useTheme } from '../../../context/AccessibilityContext';
import { useToast } from '../../../context/ToastContext';
import { statusColor } from '../../../theme';
import type { ObservationSeverity, ObservationType, ScheduleItem } from '../../../types/models';
import { formatDateOnly, humanise } from '../../../utils/format';

const OBS_TYPES: { value: ObservationType; label: string }[] = [
  { value: 'confusion', label: 'Confusion / disorientation' },
  { value: 'wandering', label: 'Wandering' },
  { value: 'agitation', label: 'Agitation / anger' },
  { value: 'mood_change', label: 'Sudden mood change' },
  { value: 'medication_confusion', label: 'Medication confusion' },
  { value: 'sleep_disturbance', label: 'Sleep disturbance' },
  { value: 'safety_concern', label: 'Safety concern' },
];
const SEVERITIES: { value: ObservationSeverity; label: string }[] = [
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
  { value: 'critical', label: 'Critical — alerts other caregivers' },
];

export default function MonitoringScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { query: overview, patients, selectedId, setSelectedId, selected } = useCaregiverPatients();

  const timeline = useQuery({
    queryKey: qk.patientTimeline(selectedId),
    queryFn: () => caregiverDashboardApi.getPatientTimeline(selectedId),
    enabled: Boolean(selectedId),
  });
  const adherence = useQuery({
    queryKey: qk.patientAdherence(selectedId),
    queryFn: () => caregiverDashboardApi.getPatientAdherence(selectedId),
    enabled: Boolean(selectedId),
  });

  const refreshPatient = () => {
    queryClient.invalidateQueries({ queryKey: qk.patientTimeline(selectedId) });
    queryClient.invalidateQueries({ queryKey: qk.patientAdherence(selectedId) });
    queryClient.invalidateQueries({ queryKey: qk.caregiverOverview });
  };

  const confirm = useMutation({
    mutationFn: (v: { item: ScheduleItem; status: 'taken' | 'skipped' }) =>
      adherenceApi.confirmDose({
        patientUserId: selectedId,
        medicationId: v.item.medicationId,
        timeOfDay: v.item.timeOfDay,
        status: v.status,
        notes: 'Administered by caregiver.',
      }),
    onSuccess: (_d, v) => {
      toast.success(`Medication marked as ${v.status}!`);
      refreshPatient();
    },
    onError: (e) => toast.error(errorMessage(e) || 'Failed to update medication status.'),
  });

  // Behavioural observation sheet
  const [obsOpen, setObsOpen] = useState(false);
  const [obsType, setObsType] = useState<ObservationType>('confusion');
  const [obsSeverity, setObsSeverity] = useState<ObservationSeverity>('mild');
  const [obsDesc, setObsDesc] = useState('');
  const [obsActions, setObsActions] = useState('');
  const logObs = useMutation({
    mutationFn: () =>
      caregiverDashboardApi.logBehavioralObservation({
        patientUserId: selectedId,
        observationType: obsType,
        description: obsDesc.trim(),
        severity: obsSeverity,
        actionsTaken: obsActions.trim(),
      }),
    onSuccess: () => {
      toast.success('Behavioral observation logged successfully!');
      setObsDesc('');
      setObsActions('');
      setObsOpen(false);
      refreshPatient();
    },
    onError: (e) => toast.error(errorMessage(e) || 'Failed to log behavioral observation.'),
  });

  // Emergency contact sheet
  const [contactOpen, setContactOpen] = useState(false);
  const [contact, setContact] = useState({ name: '', relation: '', phone: '', email: '' });
  const addContact = useMutation({
    mutationFn: () => caregiverDashboardApi.addEmergencyContact({ patientUserId: selectedId, ...contact }),
    onSuccess: () => {
      toast.success('Emergency contact added!');
      setContact({ name: '', relation: '', phone: '', email: '' });
      setContactOpen(false);
      queryClient.invalidateQueries({ queryKey: qk.emergencyContacts(selectedId) });
    },
    onError: (e) => toast.error(errorMessage(e) || 'Failed to add contact.'),
  });

  if (overview.isPending) return <LoadingState label="Loading assigned patients…" />;
  if (overview.isError && !overview.data) return <ErrorState error={overview.error} onRetry={overview.refetch} />;
  if (patients.length === 0) {
    return <EmptyState icon="people-outline" title="No assigned patients found" message="Accept a patient's care request from the Overview tab." />;
  }

  const schedule = adherence.data?.todayStatus.schedule ?? [];

  return (
    <Screen onRefresh={() => Promise.all([overview.refetch(), timeline.refetch(), adherence.refetch()])}>
      <PatientSelector
        patients={patients}
        selectedId={selectedId}
        onSelect={setSelectedId}
        renderMeta={(p) => `Adherence ${p.todayAdherence}% · Risk ${p.riskLevel}`}
      />

      {selected && (
        <Card>
          <AppText variant="title">
            {selected.firstName} {selected.lastName}
          </AppText>
          <RiskBadge level={selected.riskLevel} score={selected.riskScore} />
          <AppText variant="caption" tone="faint">
            Gender: {humanise(selected.gender ?? '—')} · Birthdate: {formatDateOnly(selected.dateOfBirth)}
          </AppText>
          <Button
            title="Log cognitive assessment"
            icon="bulb-outline"
            variant="secondary"
            onPress={() => router.push({ pathname: '/cognitive', params: { patientId: selectedId } })}
          />
        </Card>
      )}

      <SectionHeader title="💊 Today's medication schedule" />
      {adherence.isPending ? (
        <LoadingState />
      ) : adherence.isError ? (
        <ErrorState error={adherence.error} onRetry={adherence.refetch} />
      ) : schedule.length === 0 ? (
        <Card>
          <AppText tone="faint">No medications scheduled for today.</AppText>
        </Card>
      ) : (
        schedule.map((item) => {
          const actionable = item.status === 'pending' || item.status === 'missed';
          const busy = confirm.isPending && confirm.variables?.item === item;
          return (
            <Card key={`${item.medicationId}-${item.timeOfDay}`}>
              <View style={screenStyles.row}>
                <View style={screenStyles.flex}>
                  <AppText weight="700">{item.medicineName}</AppText>
                  <AppText variant="caption" tone="faint">
                    Dosage: {item.dosage} · Scheduled: {item.timeOfDay}
                  </AppText>
                </View>
                <Pill label={item.status} color={statusColor(colors, item.status)} />
              </View>
              {actionable && (
                <View style={screenStyles.row}>
                  <Button title="Administered" icon="checkmark" variant="success" loading={busy && confirm.variables?.status === 'taken'} disabled={busy} onPress={() => confirm.mutate({ item, status: 'taken' })} style={screenStyles.flex} accessibilityLabel={`Mark ${item.medicineName} ${item.timeOfDay} as administered`} />
                  <Button title="Skipped" icon="close" variant="danger" disabled={busy} onPress={() => confirm.mutate({ item, status: 'skipped' })} style={screenStyles.flex} accessibilityLabel={`Mark ${item.medicineName} ${item.timeOfDay} as skipped`} />
                </View>
              )}
            </Card>
          );
        })
      )}

      <View style={screenStyles.row}>
        <Button title="Log observation" icon="eye-outline" variant="secondary" onPress={() => setObsOpen(true)} style={screenStyles.flex} />
        <Button title="Add contact" icon="call-outline" variant="secondary" onPress={() => setContactOpen(true)} style={screenStyles.flex} />
      </View>

      <SectionHeader title="Activity timeline" icon="git-commit-outline" />
      {timeline.isPending ? (
        <LoadingState />
      ) : timeline.isError ? (
        <ErrorState error={timeline.error} onRetry={timeline.refetch} />
      ) : (
        <TimelineList events={timeline.data} />
      )}

      <Sheet
        visible={obsOpen}
        onClose={() => setObsOpen(false)}
        title="Log behavioral observation"
        footer={<Button title="Log observation" icon="add" onPress={() => logObs.mutate()} disabled={!obsDesc.trim()} loading={logObs.isPending} style={screenStyles.flex} />}
      >
        <SelectField label="Type" value={obsType} options={OBS_TYPES} onChange={setObsType} />
        <SelectField label="Severity" value={obsSeverity} options={SEVERITIES} onChange={setObsSeverity} />
        <TextField label="Description" required value={obsDesc} onChangeText={setObsDesc} placeholder="Detail what happened, location, triggers…" multiline />
        <TextField label="Actions taken" value={obsActions} onChangeText={setObsActions} placeholder="e.g. Guided to bed, gave water…" />
      </Sheet>

      <Sheet
        visible={contactOpen}
        onClose={() => setContactOpen(false)}
        title="Add emergency contact"
        footer={
          <Button
            title="Add emergency contact"
            icon="add"
            onPress={() => addContact.mutate()}
            disabled={!contact.name.trim() || !contact.relation.trim() || !contact.phone.trim()}
            loading={addContact.isPending}
            style={screenStyles.flex}
          />
        }
      >
        <TextField label="Name" required value={contact.name} onChangeText={(v) => setContact((c) => ({ ...c, name: v }))} placeholder="Contact name" />
        <TextField label="Relation" required value={contact.relation} onChangeText={(v) => setContact((c) => ({ ...c, relation: v }))} placeholder="e.g. Spouse, Son" />
        <TextField label="Phone number" required value={contact.phone} onChangeText={(v) => setContact((c) => ({ ...c, phone: v }))} keyboardType="phone-pad" placeholder="Phone number" />
        <TextField label="Email (optional)" value={contact.email} onChangeText={(v) => setContact((c) => ({ ...c, email: v }))} keyboardType="email-address" autoCapitalize="none" placeholder="Email address" />
      </Sheet>
    </Screen>
  );
}
