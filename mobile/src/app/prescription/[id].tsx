/**
 * Prescription detail — status, medication plan, the (decrypted) document,
 * change history, and the actions each role has:
 *   doctor            verify / reject
 *   patient/caregiver re-extract from text, edit medications
 *   anyone with access apply to schedule (once verified), archive / restore
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Linking, Platform, StyleSheet, View } from 'react-native';

import { errorMessage } from '../../api/client';
import { qk } from '../../api/queryClient';
import { prescriptionApi } from '../../api/services';
import { PrescriptionStatusPill } from '../../components/PrescriptionStatusPill';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card, KeyValue, Pill, SectionHeader } from '../../components/ui/Card';
import { TextField } from '../../components/ui/Form';
import { Screen, screenStyles } from '../../components/ui/Screen';
import { Sheet } from '../../components/ui/Sheet';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { useTheme } from '../../context/AccessibilityContext';
import { useCurrentUser } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { UserRef } from '../../types/models';
import { confirmAction } from '../../utils/confirm';
import { formatDateOnly, formatDateTime, fullName, humanise } from '../../utils/format';

export default function PrescriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useCurrentUser();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const rx = useQuery({ queryKey: qk.prescription(id), queryFn: () => prescriptionApi.get(id) });
  const history = useQuery({ queryKey: qk.prescriptionHistory(id), queryFn: () => prescriptionApi.history(id) });
  const [docUri, setDocUri] = useState<string | null>(null);
  const [docBusy, setDocBusy] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    queryClient.invalidateQueries({ queryKey: ['medications'] });
    queryClient.invalidateQueries({ queryKey: ['doctor'] });
    queryClient.invalidateQueries({ queryKey: ['caregiver'] });
  };

  const [verifyOpen, setVerifyOpen] = useState<'verified' | 'rejected' | null>(null);
  const [note, setNote] = useState('');
  const verify = useMutation({
    mutationFn: (status: 'verified' | 'rejected') => prescriptionApi.verify(id, status, note),
    onSuccess: (_d, status) => {
      toast.success(`Prescription ${status}.`);
      setVerifyOpen(null);
      setNote('');
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const apply = useMutation({
    mutationFn: () => prescriptionApi.apply(id),
    onSuccess: (r) => {
      toast.success(r.created.length ? `${r.created.length} medication${r.created.length === 1 ? '' : 's'} added to the schedule.` : 'All medications were already on the schedule.');
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const reparse = useMutation({
    mutationFn: () => prescriptionApi.parse(id),
    onSuccess: (r) => {
      toast.success(`${r.prescription.medications.length} medication(s) extracted.`);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const archive = useMutation({
    mutationFn: (restore: boolean) => prescriptionApi.archive(id, restore),
    onSuccess: (_d, restore) => {
      toast.success(restore ? 'Prescription restored.' : 'Prescription archived.');
      invalidate();
      if (!restore) router.back();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const loadDocument = async () => {
    if (!rx.data?.file?.originalName) return;
    setDocBusy(true);
    try {
      const uri = await prescriptionApi.fileDataUri(id, rx.data.file.mimeType);
      if (rx.data.file.mimeType === 'application/pdf') {
        if (Platform.OS === 'web') {
          const win = window.open();
          if (win) win.document.write(`<iframe src="${uri}" style="width:100%;height:100%;border:0"></iframe>`);
        } else {
          await Linking.openURL(uri).catch(() => toast.info('Saved document is a PDF; use "Share" from the file viewer to open it.'));
        }
      } else {
        setDocUri(uri);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDocBusy(false);
    }
  };

  if (rx.isPending) return <LoadingState label="Loading prescription…" />;
  if (rx.isError && !rx.data) return <ErrorState error={rx.error} onRetry={rx.refetch} />;
  const p = rx.data!;
  const isDoctor = user.role === 'doctor';
  const canApply = p.status === 'verified' || isDoctor;

  return (
    <Screen onRefresh={() => Promise.all([rx.refetch(), history.refetch()])}>
      <Card accent={p.status === 'verified' ? colors.success : p.status === 'rejected' ? colors.danger : colors.warning}>
        <View style={screenStyles.row}>
          <AppText variant="title" style={screenStyles.flex}>
            {p.title}
          </AppText>
          <PrescriptionStatusPill status={p.status} />
        </View>
        <KeyValue label="Patient" value={fullName(p.patientUserId as UserRef)} />
        <KeyValue label="Doctor" value={p.doctorName || '—'} />
        <KeyValue label="Issued" value={formatDateOnly(p.issuedDate)} />
        {p.expiryDate ? <KeyValue label="Valid until" value={formatDateOnly(p.expiryDate)} /> : null}
        {p.diagnosis ? <KeyValue label="Diagnosis" value={p.diagnosis} /> : null}
        <KeyValue label="Uploaded by" value={`${fullName(p.uploadedBy as UserRef)} (${p.uploadedByRole})`} />
        {p.verifiedAt ? <KeyValue label={p.status === 'rejected' ? 'Rejected by' : 'Verified by'} value={`${fullName(p.verifiedBy as UserRef)} · ${formatDateTime(p.verifiedAt)}`} /> : null}
        {p.verificationNote ? <AppText tone="muted">Doctor's note: {p.verificationNote}</AppText> : null}
        {p.notes ? <AppText tone="muted">{p.notes}</AppText> : null}
        {p.isArchived ? <Pill label="Archived" color={colors.textFaint} /> : null}
      </Card>

      {isDoctor && p.status === 'pending' && !p.isArchived ? (
        <View style={screenStyles.row}>
          <Button title="Reject" icon="close" variant="danger" onPress={() => setVerifyOpen('rejected')} style={screenStyles.flex} />
          <Button title="Verify" icon="checkmark-circle" variant="success" onPress={() => setVerifyOpen('verified')} style={screenStyles.flex} />
        </View>
      ) : null}
      {p.status === 'pending' && !isDoctor ? (
        <Card>
          <AppText tone="muted">⏳ Waiting for a doctor to verify this prescription before it can be applied to the schedule.</AppText>
        </Card>
      ) : null}

      <SectionHeader title={`Medication plan (${p.medications.length})`} icon="medkit-outline" />
      {p.medications.length === 0 ? (
        <Card>
          <AppText tone="faint">No medications listed.</AppText>
          {p.rawText ? <Button title="Extract from text" icon="sparkles-outline" variant="secondary" onPress={() => reparse.mutate()} loading={reparse.isPending} /> : null}
        </Card>
      ) : (
        p.medications.map((m, i) => (
          <Card key={m._id ?? i}>
            <View style={screenStyles.row}>
              <AppText weight="700" style={screenStyles.flex}>
                {m.medicineName} {m.dosage}
              </AppText>
              {typeof m.confidence === 'number' && m.confidence < 0.7 ? <Pill label="verify" color={colors.warning} /> : null}
            </View>
            <AppText variant="caption" tone="muted">
              {humanise(m.frequency)} · {m.timeOfDay.join(', ')}
              {m.durationDays ? ` · ${m.durationDays} days` : ''}
              {m.instructions ? ` · ${m.instructions}` : ''}
            </AppText>
          </Card>
        ))
      )}
      {p.medications.length > 0 && !p.isArchived ? (
        <Button
          title={p.appliedAt ? 'Apply again (adds missing medicines)' : 'Apply to medication schedule'}
          icon="download-outline"
          disabled={!canApply}
          loading={apply.isPending}
          onPress={async () => {
            if (await confirmAction('Apply prescription', `Add ${p.medications.length} medication(s) to the schedule?`, 'Apply', false)) apply.mutate();
          }}
        />
      ) : null}
      {p.appliedAt ? (
        <AppText variant="caption" tone="faint">
          Last applied {formatDateTime(p.appliedAt)}.
        </AppText>
      ) : null}

      {p.rawText ? (
        <>
          <SectionHeader title="Prescription text" icon="reader-outline" />
          <Card>
            <AppText tone="muted">{p.rawText}</AppText>
            {!isDoctor || p.status !== 'verified' ? <Button title="Re-extract medications" icon="sparkles-outline" variant="ghost" onPress={() => reparse.mutate()} loading={reparse.isPending} /> : null}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Document" icon="attach-outline" />
      <Card>
        {p.file?.originalName ? (
          <>
            <AppText variant="caption" tone="faint">
              {p.file.originalName} · {p.file.size ? `${Math.round(p.file.size / 1024)} KB` : ''} · encrypted at rest
            </AppText>
            {docUri ? <Image source={{ uri: docUri }} style={styles.doc} resizeMode="contain" accessibilityLabel="Prescription document" /> : null}
            <Button title={docUri ? 'Reload document' : p.file.mimeType === 'application/pdf' ? 'Open PDF' : 'View document'} icon="eye-outline" variant="secondary" onPress={loadDocument} loading={docBusy} />
          </>
        ) : (
          <AppText tone="faint">No document attached.</AppText>
        )}
      </Card>

      <SectionHeader title="History" icon="time-outline" />
      <Card>
        {history.isPending ? (
          <LoadingState />
        ) : history.data && history.data.length ? (
          history.data
            .slice()
            .reverse()
            .map((h, i) => (
              <View key={i} style={styles.histRow}>
                <AppText variant="caption" weight="700" style={styles.histAction}>
                  {humanise(h.action)}
                </AppText>
                <View style={screenStyles.flex}>
                  <AppText variant="caption" tone="muted">
                    {h.by ? `${fullName(h.by)} (${h.byRole})` : humanise(h.byRole ?? 'system')} · {formatDateTime(h.at)}
                  </AppText>
                  {h.note ? (
                    <AppText variant="caption" tone="faint">
                      {h.note}
                    </AppText>
                  ) : null}
                </View>
              </View>
            ))
        ) : (
          <AppText tone="faint">No history.</AppText>
        )}
      </Card>

      <Button
        title={p.isArchived ? 'Restore prescription' : 'Archive prescription'}
        icon={p.isArchived ? 'refresh-outline' : 'archive-outline'}
        variant={p.isArchived ? 'secondary' : 'danger'}
        onPress={async () => {
          if (p.isArchived || (await confirmAction('Archive prescription', 'It stays in the archive with its history and can be restored.', 'Archive'))) archive.mutate(p.isArchived);
        }}
      />

      <Sheet
        visible={Boolean(verifyOpen)}
        onClose={() => setVerifyOpen(null)}
        title={verifyOpen === 'verified' ? 'Verify prescription' : 'Reject prescription'}
        footer={
          <>
            <Button title="Cancel" variant="secondary" onPress={() => setVerifyOpen(null)} style={screenStyles.flex} />
            <Button title={verifyOpen === 'verified' ? 'Verify' : 'Reject'} variant={verifyOpen === 'verified' ? 'success' : 'danger'} loading={verify.isPending} onPress={() => verify.mutate(verifyOpen!)} style={screenStyles.flex} />
          </>
        }
      >
        <AppText tone="muted">{verifyOpen === 'verified' ? 'Confirm the medication list matches the prescription. The patient can then apply it to their schedule.' : 'Tell the patient why this prescription cannot be used.'}</AppText>
        <TextField label="Note" value={note} onChangeText={setNote} multiline placeholder={verifyOpen === 'verified' ? 'Optional' : 'Reason for rejection'} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  doc: { width: '100%', height: 320, borderRadius: 12, backgroundColor: '#000' },
  histRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  histAction: { width: 110 },
});
