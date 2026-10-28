/**
 * Patient records — the expandable patient panel of CaregiverDashboard.jsx as
 * its own screen: recent vitals, medications for a date, add / edit / delete
 * medication, "Log <time>" dose buttons.
 *
 * Vitals come from GET /caregiver/patients/:id/records. Medications come from
 * GET /caregiver/patients/:id/medications — the web reads them from /records,
 * whose medication query never matches (see services.ts), so the web list is
 * always empty.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { errorMessage } from '../../../api/client';
import { qk } from '../../../api/queryClient';
import { caregiverApi } from '../../../api/services';
import { DateNavigator } from '../../../components/DateNavigator';
import { MedicationFormSheet } from '../../../components/MedicationFormSheet';
import { AppText } from '../../../components/ui/AppText';
import { Button, IconButton } from '../../../components/ui/Button';
import { Card, SectionHeader } from '../../../components/ui/Card';
import { Screen, screenStyles } from '../../../components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import { useTheme } from '../../../context/AccessibilityContext';
import { useToast } from '../../../context/ToastContext';
import type { Medication, MedicationPayload, TimeOfDay } from '../../../types/models';
import { confirmAction } from '../../../utils/confirm';
import { formatDate, formatDateOnly, formatDateTime, isMedicationActiveOn } from '../../../utils/format';

export default function PatientRecordsScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [loggingKey, setLoggingKey] = useState<string | null>(null);

  const records = useQuery({ queryKey: qk.patientRecords(id), queryFn: () => caregiverApi.getPatientRecords(id) });
  const meds = useQuery({ queryKey: qk.patientMedications(id), queryFn: () => caregiverApi.getPatientMedications(id) });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.patientMedications(id) });
    queryClient.invalidateQueries({ queryKey: qk.caregiverOverview });
  };

  const save = useMutation({
    mutationFn: (payload: MedicationPayload) =>
      editing ? caregiverApi.updatePatientMedication(id, editing._id, payload) : caregiverApi.addPatientMedication(id, payload),
    onSuccess: () => {
      toast.success(`Medication ${editing ? 'updated' : 'added'} for ${name ?? 'patient'}`);
      setFormOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e) || 'Failed to save medication'),
  });

  const remove = useMutation({
    mutationFn: (medId: string) => caregiverApi.deletePatientMedication(id, medId),
    onSuccess: () => {
      toast.success('Medication deleted');
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e) || 'Failed to delete medication'),
  });

  const logDose = async (med: Medication, time: TimeOfDay) => {
    setLoggingKey(`${med._id}-${time}`);
    try {
      // web logs "now" regardless of the selected date; keep the same behaviour.
      await caregiverApi.logPatientDose(id, med._id, { date: new Date().toISOString(), timeOfDay: time, status: 'taken' });
      toast.success(`${time} dose of ${med.medicineName} logged for patient`);
      invalidate();
    } catch (e) {
      toast.error(errorMessage(e) || 'Failed to log dose');
    } finally {
      setLoggingKey(null);
    }
  };

  const scheduled = useMemo(() => (meds.data ?? []).filter((m) => isMedicationActiveOn(m, date)), [meds.data, date]);

  return (
    <Screen onRefresh={() => Promise.all([records.refetch(), meds.refetch()])}>
      <Stack.Screen options={{ title: name ?? 'Patient Records' }} />

      <SectionHeader
        title="Medications"
        icon="medkit-outline"
        action={<Button title="Add" icon="add" variant="ghost" onPress={() => { setEditing(null); setFormOpen(true); }} />}
      />
      <DateNavigator date={date} onChange={setDate} />
      {meds.isPending ? (
        <LoadingState />
      ) : meds.isError ? (
        <ErrorState error={meds.error} onRetry={meds.refetch} />
      ) : scheduled.length === 0 ? (
        <EmptyState icon="medkit-outline" title="No medications found" message="Nothing is scheduled for this date." />
      ) : (
        scheduled.map((med) => (
          <Card key={med._id}>
            <View style={screenStyles.row}>
              <View style={screenStyles.flex}>
                <AppText variant="heading">
                  {med.medicineName} <AppText tone="faint">({med.dosage})</AppText>
                </AppText>
                <AppText variant="caption" tone="faint">
                  {med.frequency} · {med.timeOfDay.join(', ') || 'N/A'}
                </AppText>
                <AppText variant="caption" tone="faint">
                  {formatDateOnly(med.startDate)}
                  {med.endDate ? ` – ${formatDateOnly(med.endDate)}` : ''}
                </AppText>
              </View>
              <IconButton icon="create-outline" accessibilityLabel={`Edit ${med.medicineName}`} onPress={() => { setEditing(med); setFormOpen(true); }} />
              <IconButton
                icon="trash-outline"
                color={colors.danger}
                accessibilityLabel={`Delete ${med.medicineName}`}
                onPress={async () => {
                  if (await confirmAction('Delete medication', `Delete ${med.medicineName}?`)) remove.mutate(med._id);
                }}
              />
            </View>
            <View style={screenStyles.wrap}>
              {med.timeOfDay.map((t) => (
                <Button
                  key={t}
                  title={`Log ${t}`}
                  icon="checkmark"
                  variant="success"
                  loading={loggingKey === `${med._id}-${t}`}
                  onPress={() => logDose(med, t)}
                  accessibilityLabel={`Mark ${t} dose of ${med.medicineName} as taken`}
                />
              ))}
            </View>
          </Card>
        ))
      )}

      <SectionHeader title="Recent vitals" icon="pulse-outline" />
      {records.isPending ? (
        <LoadingState />
      ) : records.isError ? (
        <ErrorState error={records.error} onRetry={records.refetch} />
      ) : records.data.vitals.length === 0 ? (
        <Card>
          <AppText tone="faint">No vitals recorded.</AppText>
        </Card>
      ) : (
        records.data.vitals.slice(0, 5).map((v) => (
          <Card key={v._id}>
            <AppText weight="700">
              {v.heartRate ?? '—'} bpm · {v.bloodPressure?.systolic ?? '—'}/{v.bloodPressure?.diastolic ?? '—'} mmHg
            </AppText>
            <AppText variant="caption" tone="faint">
              {formatDateTime(v.recordedAt)}
              {v.oxygenLevel ? ` · SpO2 ${v.oxygenLevel}%` : ''}
              {v.bloodSugar ? ` · Sugar ${v.bloodSugar} mg/dL` : ''}
            </AppText>
          </Card>
        ))
      )}

      <MedicationFormSheet
        visible={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSubmit={(p) => save.mutate(p)}
        editing={editing}
        title={`${editing ? 'Edit' : 'Add'} medication for ${name ?? 'patient'}`}
        saving={save.isPending}
        showNotes={false}
      />
    </Screen>
  );
}
