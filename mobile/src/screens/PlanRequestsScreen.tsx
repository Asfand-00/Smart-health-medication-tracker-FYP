/**
 * Medication plan approvals (FR8 / FR9).
 *  - patient / caregiver: propose add | update | stop to a caregiver or
 *    doctor in the care circle, follow the decision, cancel while pending
 *  - caregiver / doctor: review requests sent to them (approve applies the
 *    change on the server)
 * Used as a root screen (/plan-requests) and as the doctor's "Approvals" tab.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { errorMessage } from '../api/client';
import { qk } from '../api/queryClient';
import { caregiverApi, doctorApi, medicationApi, planApi } from '../api/services';
import { PatientPicker, usePatientContext } from '../components/PatientContext';
import { AppText } from '../components/ui/AppText';
import { Button } from '../components/ui/Button';
import { Card, Pill, SectionHeader } from '../components/ui/Card';
import { ChipGroup, SegmentedControl, SelectField, TextField } from '../components/ui/Form';
import { Screen, screenStyles } from '../components/ui/Screen';
import { Sheet } from '../components/ui/Sheet';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { useTheme } from '../context/AccessibilityContext';
import { useCurrentUser } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { MedicationPlanRequest, PlanRequestType, TimeOfDay, UserRef } from '../types/models';
import { TIMES_OF_DAY } from '../types/models';
import { formatDateTime, fullName } from '../utils/format';

const refName = (r: UserRef | string | null | undefined) => (r && typeof r === 'object' ? fullName(r) : 'Unknown');

function describe(r: MedicationPlanRequest): string {
  const name = r.proposed?.medicineName || r.medicationSnapshot?.medicineName || 'medication';
  if (r.type === 'add') return `Add ${name} ${r.proposed?.dosage ?? ''} (${r.proposed?.timeOfDay?.join(', ') ?? ''})`;
  if (r.type === 'stop') return `Stop ${name} ${r.medicationSnapshot?.dosage ?? ''}`;
  const changes = Object.entries(r.proposed ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v).slice(0, 10)}`)
    .join(' · ');
  return `Change ${name} → ${changes || 'details'}`;
}

export function PlanRequestsScreen() {
  const user = useCurrentUser();
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const ctx = usePatientContext();
  const isReviewer = user.role === 'caregiver' || user.role === 'doctor';
  const canRequest = user.role === 'patient' || user.role === 'caregiver';
  const [view, setView] = useState<'review' | 'mine'>(isReviewer ? 'review' : 'mine');

  const pending = useQuery({ queryKey: qk.planPending, queryFn: () => planApi.pending('all'), enabled: isReviewer });
  const mine = useQuery({ queryKey: qk.planRequests(ctx.patientId), queryFn: () => planApi.mine(ctx.patientParam), enabled: canRequest && Boolean(ctx.patientId) });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['plans'] });
    queryClient.invalidateQueries({ queryKey: ['medications'] });
    queryClient.invalidateQueries({ queryKey: ['caregiver'] });
    queryClient.invalidateQueries({ queryKey: ['doctor'] });
  };
  const review = useMutation({
    mutationFn: (v: { id: string; status: 'approved' | 'rejected'; note?: string }) => planApi.review(v.id, v.status, v.note),
    onSuccess: (_d, v) => {
      toast.success(`Request ${v.status}.`);
      setReviewNote('');
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const cancel = useMutation({ mutationFn: planApi.cancel, onSuccess: () => { toast.success('Request cancelled.'); invalidate(); }, onError: (e) => toast.error(errorMessage(e)) });
  const [reviewNote, setReviewNote] = useState('');

  // ── new request sheet ──
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<PlanRequestType>('add');
  const [reviewerId, setReviewerId] = useState('');
  const [medicationId, setMedicationId] = useState('');
  const [reason, setReason] = useState('');
  const [proposed, setProposed] = useState({ medicineName: '', dosage: '', timeOfDay: ['Morning'] as TimeOfDay[], notes: '' });

  const reviewers = useQuery({
    queryKey: ['plans', 'reviewers', ctx.patientId, user.role],
    queryFn: async () => {
      if (user.role === 'patient') {
        const [team, doctors] = await Promise.all([caregiverApi.getMyTeam(), doctorApi.myDoctors()]);
        return [...team.map((c) => ({ value: c._id, label: `${fullName(c)} (caregiver)` })), ...doctors.map((d) => ({ value: d._id, label: `Dr. ${fullName(d)}${d.speciality ? ` · ${d.speciality}` : ''}` }))];
      }
      // caregiver: the patient's doctors (a caregiver cannot approve their own request)
      const overview = await doctorApi.available().catch(() => []);
      return overview.map((d) => ({ value: d._id, label: `Dr. ${fullName(d)}` }));
    },
    enabled: open && canRequest,
  });
  const meds = useQuery({
    queryKey: ['plans', 'meds', ctx.patientId],
    queryFn: () => (user.role === 'patient' ? medicationApi.getAll() : caregiverApi.getPatientMedications(ctx.patientId)),
    enabled: open && canRequest && Boolean(ctx.patientId),
  });
  const create = useMutation({
    mutationFn: () =>
      planApi.create({
        type,
        reviewerId,
        medicationId: type === 'add' ? undefined : medicationId,
        proposed: type === 'stop' ? undefined : type === 'add' ? { medicineName: proposed.medicineName.trim(), dosage: proposed.dosage.trim(), timeOfDay: proposed.timeOfDay, frequency: 'daily', notes: proposed.notes } : { dosage: proposed.dosage.trim() || undefined, timeOfDay: proposed.timeOfDay, notes: proposed.notes || undefined },
        reason,
        patientUserId: ctx.patientParam,
      }),
    onSuccess: () => {
      toast.success('Request sent for approval.');
      setOpen(false);
      setReason('');
      setProposed({ medicineName: '', dosage: '', timeOfDay: ['Morning'], notes: '' });
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const valid = reviewerId && (type === 'add' ? proposed.medicineName.trim() && proposed.dosage.trim() && proposed.timeOfDay.length : medicationId);

  const statusColor = (s: string) => (s === 'approved' ? colors.success : s === 'rejected' ? colors.danger : s === 'cancelled' ? colors.textFaint : colors.warning);

  const renderRequest = (r: MedicationPlanRequest, reviewer: boolean) => (
    <Card key={r._id} accent={statusColor(r.status)}>
      <View style={screenStyles.row}>
        <View style={screenStyles.flex}>
          <AppText weight="700">{describe(r)}</AppText>
          <AppText variant="caption" tone="faint">
            {reviewer ? `For ${refName(r.patientUserId as UserRef)} · requested by ${refName(r.requestedBy as UserRef)}` : `To ${refName(r.reviewerId as UserRef)} (${r.reviewerRole})`} · {formatDateTime(r.createdAt)}
          </AppText>
        </View>
        <Pill label={r.status} color={statusColor(r.status)} />
      </View>
      {r.reason ? <AppText tone="muted">Reason: {r.reason}</AppText> : null}
      {r.reviewNote ? <AppText tone="muted">Decision note: {r.reviewNote}</AppText> : null}
      {reviewer && r.status === 'pending' ? (
        <>
          <TextField label="Note (optional)" value={reviewNote} onChangeText={setReviewNote} placeholder="Why you approve or reject" />
          <View style={screenStyles.row}>
            <Button title="Reject" icon="close" variant="danger" disabled={review.isPending} onPress={() => review.mutate({ id: r._id, status: 'rejected', note: reviewNote })} style={screenStyles.flex} />
            <Button title="Approve" icon="checkmark" variant="success" loading={review.isPending && review.variables?.id === r._id} disabled={review.isPending} onPress={() => review.mutate({ id: r._id, status: 'approved', note: reviewNote })} style={screenStyles.flex} />
          </View>
        </>
      ) : null}
      {!reviewer && r.status === 'pending' && (r.requestedBy as UserRef)?._id === (user._id || user.id) ? <Button title="Cancel request" variant="ghost" icon="close" onPress={() => cancel.mutate(r._id)} /> : null}
    </Card>
  );

  const pendingList = (pending.data ?? []).filter((r) => r.status === 'pending');
  const decided = (pending.data ?? []).filter((r) => r.status !== 'pending');

  return (
    <Screen onRefresh={() => Promise.all([pending.refetch(), mine.refetch()])}>
      <AppText tone="muted">
        {user.role === 'patient'
          ? 'Ask your caregiver or doctor to approve a change to your medication plan. Approved changes are applied automatically.'
          : user.role === 'caregiver'
            ? 'Approve or reject plan changes patients send you, or propose a change for a patient to their doctor.'
            : 'Review medication plan changes your patients and their caregivers have proposed.'}
      </AppText>
      {isReviewer && canRequest ? <SegmentedControl value={view} onChange={setView} options={[{ value: 'review', label: 'To review' }, { value: 'mine', label: 'My requests' }]} /> : null}

      {isReviewer && view === 'review' ? (
        pending.isPending ? (
          <LoadingState />
        ) : pending.isError ? (
          <ErrorState error={pending.error} onRetry={pending.refetch} />
        ) : (
          <>
            <SectionHeader title={`Waiting for your decision (${pendingList.length})`} icon="hourglass-outline" />
            {pendingList.length === 0 ? (
              <Card>
                <AppText tone="faint">Nothing to review right now.</AppText>
              </Card>
            ) : (
              pendingList.map((r) => renderRequest(r, true))
            )}
            {decided.length > 0 && (
              <>
                <SectionHeader title="Decided" icon="checkmark-done-outline" />
                {decided.slice(0, 20).map((r) => renderRequest(r, true))}
              </>
            )}
          </>
        )
      ) : null}

      {canRequest && (!isReviewer || view === 'mine') ? (
        <>
          <PatientPicker ctx={ctx} />
          <Button title="Propose a plan change" icon="create-outline" onPress={() => setOpen(true)} disabled={!ctx.patientId} />
          {mine.isPending ? (
            <LoadingState />
          ) : mine.isError ? (
            <ErrorState error={mine.error} onRetry={mine.refetch} />
          ) : (mine.data ?? []).length === 0 ? (
            <EmptyState icon="document-text-outline" title="No requests yet" message="Changes you propose and their decisions appear here." />
          ) : (
            mine.data!.map((r) => renderRequest(r, false))
          )}
        </>
      ) : null}

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Propose a plan change"
        footer={
          <>
            <Button title="Cancel" variant="secondary" onPress={() => setOpen(false)} style={screenStyles.flex} />
            <Button title="Send for approval" icon="paper-plane-outline" disabled={!valid} loading={create.isPending} onPress={() => create.mutate()} style={screenStyles.flex} />
          </>
        }
      >
        <SegmentedControl<PlanRequestType> value={type} onChange={setType} options={[{ value: 'add', label: 'Add' }, { value: 'update', label: 'Change' }, { value: 'stop', label: 'Stop' }]} />
        <SelectField label="Send to" required value={reviewerId} options={reviewers.data ?? []} onChange={setReviewerId} placeholder={reviewers.isPending ? 'Loading…' : (reviewers.data ?? []).length ? 'Choose a reviewer' : 'No caregiver or doctor linked yet'} />
        {type !== 'add' && (
          <SelectField label="Medication" required value={medicationId} options={(meds.data ?? []).map((m) => ({ value: m._id, label: `${m.medicineName} ${m.dosage}` }))} onChange={setMedicationId} />
        )}
        {type === 'add' && <TextField label="Medicine name" required value={proposed.medicineName} onChangeText={(v) => setProposed((p) => ({ ...p, medicineName: v }))} autoCapitalize="words" />}
        {type !== 'stop' && (
          <>
            <TextField label={type === 'add' ? 'Dosage' : 'New dosage (optional)'} required={type === 'add'} value={proposed.dosage} onChangeText={(v) => setProposed((p) => ({ ...p, dosage: v }))} placeholder="e.g. 500mg" />
            <ChipGroup label="Time of day" multiple options={TIMES_OF_DAY.map((t) => ({ value: t, label: t }))} selected={proposed.timeOfDay} onToggle={(t: TimeOfDay) => setProposed((p) => ({ ...p, timeOfDay: p.timeOfDay.includes(t) ? p.timeOfDay.filter((x) => x !== t) : [...p.timeOfDay, t] }))} />
            <TextField label="Instructions" value={proposed.notes} onChangeText={(v) => setProposed((p) => ({ ...p, notes: v }))} />
          </>
        )}
        <TextField label="Reason" value={reason} onChangeText={setReason} placeholder="Why this change is needed" multiline />
      </Sheet>
    </Screen>
  );
}
