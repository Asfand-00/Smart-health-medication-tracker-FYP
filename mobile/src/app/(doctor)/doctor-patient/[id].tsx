/**
 * Doctor's patient overview — GET /doctor/patients/:id/overview: profile,
 * medications (add / edit / delete), today's schedule, weekly adherence,
 * risk, recent vitals, prescriptions, clinical notes (CRUD), conditions,
 * plus links into AI insights, analytics and the calendar for this patient.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { errorMessage } from '../../../api/client';
import { qk } from '../../../api/queryClient';
import { doctorApi, patientApi } from '../../../api/services';
import { MedicationFormSheet } from '../../../components/MedicationFormSheet';
import { PrescriptionStatusPill } from '../../../components/PrescriptionStatusPill';
import { RiskBadge } from '../../../components/RiskBadge';
import { AppText } from '../../../components/ui/AppText';
import { Button, IconButton } from '../../../components/ui/Button';
import { Card, KeyValue, ListItem, Pill, SectionHeader, StatTile } from '../../../components/ui/Card';
import { AdherenceBarChart } from '../../../components/ui/Charts';
import { DateField, SelectField, TextField, ToggleRow } from '../../../components/ui/Form';
import { Screen, screenStyles } from '../../../components/ui/Screen';
import { Sheet } from '../../../components/ui/Sheet';
import { ErrorState, LoadingState } from '../../../components/ui/States';
import { useTheme } from '../../../context/AccessibilityContext';
import { useToast } from '../../../context/ToastContext';
import { statusColor } from '../../../theme';
import type { DoctorNote, DoctorNoteType, Medication, MedicationPayload } from '../../../types/models';
import { confirmAction } from '../../../utils/confirm';
import { formatDateOnly, formatDateTime, fullName, humanise } from '../../../utils/format';

const NOTE_TYPES: { value: DoctorNoteType; label: string }[] = [
  { value: 'observation', label: 'Observation' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'recommendation', label: 'Recommendation' },
  { value: 'prescription', label: 'Prescription note' },
  { value: 'follow_up', label: 'Follow-up' },
];

export default function DoctorPatientScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const overview = useQuery({ queryKey: qk.doctorOverview(id), queryFn: () => doctorApi.overview(id) });
  const conditions = useQuery({ queryKey: qk.patientConditions(id), queryFn: () => patientApi.listConditions(id) });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['doctor'] });
    queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
  };

  // medications
  const [medOpen, setMedOpen] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const saveMed = useMutation({
    mutationFn: (p: MedicationPayload) => (editing ? doctorApi.updateMedication(id, editing._id, p) : doctorApi.addMedication(id, p)),
    onSuccess: () => {
      toast.success(editing ? 'Medication updated.' : 'Medication prescribed.');
      setMedOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const deleteMed = useMutation({ mutationFn: (medId: string) => doctorApi.deleteMedication(id, medId), onSuccess: () => { toast.success('Medication removed.'); invalidate(); }, onError: (e) => toast.error(errorMessage(e)) });

  // notes
  const [noteOpen, setNoteOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<DoctorNote | null>(null);
  const [note, setNote] = useState({ title: '', content: '', noteType: 'observation' as DoctorNoteType, diagnosis: '', followUpDate: '', isConfidential: false });
  const openNote = (n: DoctorNote | null) => {
    setEditingNote(n);
    setNote(n ? { title: n.title, content: n.content, noteType: n.noteType, diagnosis: n.diagnosis, followUpDate: n.followUpDate ? n.followUpDate.slice(0, 10) : '', isConfidential: n.isConfidential } : { title: '', content: '', noteType: 'observation', diagnosis: '', followUpDate: '', isConfidential: false });
    setNoteOpen(true);
  };
  const saveNote = useMutation({
    mutationFn: () => {
      const payload = { ...note, followUpDate: note.followUpDate || null, patientUserId: id };
      return editingNote ? doctorApi.updateNote(editingNote._id, payload) : doctorApi.addNote(payload);
    },
    onSuccess: () => {
      toast.success('Note saved.');
      setNoteOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const deleteNote = useMutation({ mutationFn: doctorApi.deleteNote, onSuccess: () => { toast.success('Note deleted.'); invalidate(); }, onError: (e) => toast.error(errorMessage(e)) });

  if (overview.isPending) return <LoadingState label="Loading patient…" />;
  if (overview.isError && !overview.data) return <ErrorState error={overview.error} onRetry={overview.refetch} />;
  const d = overview.data!;
  const patientParams = { patientId: id, name: name ?? fullName(d.user) };

  return (
    <Screen onRefresh={() => Promise.all([overview.refetch(), conditions.refetch()])}>
      <Card>
        <View style={screenStyles.row}>
          <AppText variant="title" style={screenStyles.flex}>
            {fullName(d.user)}
          </AppText>
          <RiskBadge level={d.risk.overallRisk} score={d.risk.score} />
        </View>
        <AppText variant="caption" tone="faint">
          {d.user.email} · {humanise(d.user.gender ?? '')} · born {formatDateOnly(d.user.dateOfBirth)}
        </AppText>
        {d.profile ? (
          <>
            <KeyValue label="Blood group" value={d.profile.bloodGroup} />
            <KeyValue label="Chronic diseases" value={d.profile.medicalHistory?.chronicDiseases?.join(', ') || '—'} />
            <KeyValue label="Allergies" value={d.profile.medicalHistory?.allergies?.join(', ') || '—'} />
          </>
        ) : (
          <AppText tone="faint">The patient has not completed their medical profile.</AppText>
        )}
      </Card>

      <View style={screenStyles.wrap}>
        <StatTile label="Today" value={`${d.today.adherencePercent}%`} sub={`${d.today.taken + d.today.delayed}/${d.today.total} doses`} icon="today-outline" color={colors.primary} />
        <StatTile label="This week" value={`${d.weekly.summary.weeklyAdherencePercent}%`} sub={`${d.weekly.summary.missedDoses} missed`} icon="calendar-outline" color={colors.teal} />
        <StatTile label="Most missed" value={d.patterns.mostMissedTime ?? '—'} sub={d.patterns.mostMissedDay ? `on ${d.patterns.mostMissedDay}s` : ''} icon="alert-circle-outline" color={colors.orange} />
        <StatTile label="Risk score" value={d.risk.score} sub={d.risk.factors[0]?.factor ?? 'no factors'} icon="shield-outline" color={colors.danger} />
      </View>

      <Card>
        <ListItem title="AI insights & predictions" icon="sparkles-outline" onPress={() => router.push({ pathname: '/ai-insights', params: patientParams })} />
        <ListItem title="Health analytics & reports" icon="analytics-outline" onPress={() => router.push({ pathname: '/analytics', params: patientParams })} />
        <ListItem title="Medication calendar" icon="calendar-outline" onPress={() => router.push({ pathname: '/calendar', params: patientParams })} />
        <ListItem title="Drug interactions" icon="git-compare-outline" onPress={() => router.push({ pathname: '/drug-info', params: patientParams })} />
        <ListItem title="Plan approvals" icon="checkmark-done-outline" onPress={() => router.navigate('/approvals')} />
      </Card>

      <SectionHeader title="7-day adherence" icon="bar-chart-outline" />
      <Card>
        <AdherenceBarChart data={d.weekly.dailyData} />
      </Card>

      <SectionHeader title={`Medications (${d.medications.length})`} icon="medkit-outline" action={<Button title="Prescribe" variant="ghost" icon="add" onPress={() => { setEditing(null); setMedOpen(true); }} />} />
      {d.medications.length === 0 ? (
        <Card>
          <AppText tone="faint">No medications on the schedule.</AppText>
        </Card>
      ) : (
        d.medications.map((m) => (
          <Card key={m._id}>
            <View style={screenStyles.row}>
              <View style={screenStyles.flex}>
                <AppText weight="700">
                  {m.medicineName} {m.dosage}
                </AppText>
                <AppText variant="caption" tone="faint">
                  {m.frequency} · {m.timeOfDay.join(', ')} · from {formatDateOnly(m.startDate)}
                  {m.endDate ? ` to ${formatDateOnly(m.endDate)}` : ''}
                  {m.addedByRole ? ` · added by ${m.addedByRole}` : ''}
                </AppText>
              </View>
              <IconButton icon="create-outline" accessibilityLabel={`Edit ${m.medicineName}`} onPress={() => { setEditing(m); setMedOpen(true); }} />
              <IconButton icon="trash-outline" color={colors.danger} accessibilityLabel={`Remove ${m.medicineName}`} onPress={async () => { if (await confirmAction('Remove medication', `Remove ${m.medicineName} from the schedule?`, 'Remove')) deleteMed.mutate(m._id); }} />
            </View>
            {m.notes ? <AppText variant="caption" tone="muted">{m.notes}</AppText> : null}
          </Card>
        ))
      )}

      <SectionHeader title="Today's schedule" icon="time-outline" />
      <Card>
        {d.today.schedule.length === 0 ? (
          <AppText tone="faint">Nothing scheduled today.</AppText>
        ) : (
          d.today.schedule.map((s) => (
            <View key={`${s.medicationId}-${s.timeOfDay}`} style={[screenStyles.row, { alignItems: 'center' }]}>
              <AppText style={screenStyles.flex}>
                {s.timeOfDay} · {s.medicineName} {s.dosage}
              </AppText>
              <Pill label={s.status} color={statusColor(colors, s.status)} />
            </View>
          ))
        )}
      </Card>

      <SectionHeader title="Prescriptions" icon="document-attach-outline" action={<Button title="Issue" variant="ghost" icon="add" onPress={() => router.push({ pathname: '/prescription-upload', params: patientParams })} />} />
      <Card>
        {d.prescriptions.length === 0 ? (
          <AppText tone="faint">No prescriptions on file.</AppText>
        ) : (
          d.prescriptions.map((p) => <ListItem key={p._id} title={p.title} subtitle={`${p.doctorName || '—'} · ${formatDateOnly(p.issuedDate)} · ${p.medications.length} meds`} icon="reader-outline" right={<PrescriptionStatusPill status={p.status} />} onPress={() => router.push(`/prescription/${p._id}`)} />)
        )}
      </Card>

      <SectionHeader title="Health conditions" icon="fitness-outline" />
      <Card>
        {conditions.data && conditions.data.length > 0 ? (
          conditions.data.map((c) => (
            <View key={c._id} style={[screenStyles.row, { alignItems: 'center' }]}>
              <View style={screenStyles.flex}>
                <AppText weight="600">{c.name}</AppText>
                <AppText variant="caption" tone="faint">
                  {c.diagnosedOn ? `since ${formatDateOnly(c.diagnosedOn)} · ` : ''}
                  {c.notes}
                </AppText>
              </View>
              <Pill label={`${c.status} · ${c.severity}`} color={c.status === 'resolved' ? colors.success : c.severity === 'severe' ? colors.danger : colors.warning} />
            </View>
          ))
        ) : (
          <AppText tone="faint">No conditions tracked.</AppText>
        )}
      </Card>

      <SectionHeader title="Recent vitals" icon="pulse-outline" />
      <Card>
        {d.vitals.length === 0 ? (
          <AppText tone="faint">No vitals recorded.</AppText>
        ) : (
          d.vitals.slice(0, 5).map((v) => (
            <KeyValue key={v._id} label={formatDateTime(v.recordedAt)} value={`BP ${v.bloodPressure?.systolic ?? '—'}/${v.bloodPressure?.diastolic ?? '—'} · HR ${v.heartRate ?? '—'} · SpO2 ${v.oxygenLevel ?? '—'}%`} />
          ))
        )}
      </Card>

      <SectionHeader title="Clinical notes" icon="create-outline" action={<Button title="Add note" variant="ghost" icon="add" onPress={() => openNote(null)} />} />
      {d.notes.length === 0 ? (
        <Card>
          <AppText tone="faint">No notes yet.</AppText>
        </Card>
      ) : (
        d.notes.map((n) => (
          <Card key={n._id} accent={n.isConfidential ? colors.textFaint : undefined}>
            <View style={screenStyles.row}>
              <View style={screenStyles.flex}>
                <AppText weight="700">{n.title}</AppText>
                <AppText variant="caption" tone="faint">
                  {humanise(n.noteType)} · {formatDateTime(n.createdAt)}
                  {n.followUpDate ? ` · follow-up ${formatDateOnly(n.followUpDate)}` : ''}
                  {n.isConfidential ? ' · confidential' : ''}
                </AppText>
              </View>
              <IconButton icon="create-outline" accessibilityLabel="Edit note" onPress={() => openNote(n)} />
              <IconButton icon="trash-outline" color={colors.danger} accessibilityLabel="Delete note" onPress={async () => { if (await confirmAction('Delete note', `Delete "${n.title}"?`)) deleteNote.mutate(n._id); }} />
            </View>
            <AppText tone="muted">{n.content}</AppText>
            {n.diagnosis ? <AppText variant="caption">Diagnosis: {n.diagnosis}</AppText> : null}
          </Card>
        ))
      )}

      <MedicationFormSheet visible={medOpen} onClose={() => { setMedOpen(false); setEditing(null); }} onSubmit={(p) => saveMed.mutate(p)} editing={editing} title={editing ? 'Edit medication' : 'Prescribe medication'} saving={saveMed.isPending} />

      <Sheet
        visible={noteOpen}
        onClose={() => setNoteOpen(false)}
        title={editingNote ? 'Edit note' : 'New clinical note'}
        footer={
          <>
            <Button title="Cancel" variant="secondary" onPress={() => setNoteOpen(false)} style={screenStyles.flex} />
            <Button title="Save note" icon="checkmark" onPress={() => saveNote.mutate()} disabled={!note.title.trim() || !note.content.trim()} loading={saveNote.isPending} style={screenStyles.flex} />
          </>
        }
      >
        <TextField label="Title" required value={note.title} onChangeText={(v) => setNote((n) => ({ ...n, title: v }))} />
        <SelectField label="Type" value={note.noteType} options={NOTE_TYPES} onChange={(v) => setNote((n) => ({ ...n, noteType: v }))} />
        <TextField label="Content" required value={note.content} onChangeText={(v) => setNote((n) => ({ ...n, content: v }))} multiline />
        <TextField label="Diagnosis" value={note.diagnosis} onChangeText={(v) => setNote((n) => ({ ...n, diagnosis: v }))} />
        <DateField label="Follow-up date" optional value={note.followUpDate} onChange={(v) => setNote((n) => ({ ...n, followUpDate: v }))} />
        <ToggleRow label="Confidential" description="Hidden from the patient and caregivers" value={note.isConfidential} onChange={(v) => setNote((n) => ({ ...n, isConfidential: v }))} />
      </Sheet>
    </Screen>
  );
}
