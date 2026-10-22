/**
 * Health condition tracking — /patient/conditions (patient) or
 * /patient/:userId/conditions (caregiver / doctor). Each condition keeps a
 * change log of status / severity updates.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { errorMessage } from '../api/client';
import { qk } from '../api/queryClient';
import { patientApi } from '../api/services';
import { useTheme } from '../context/AccessibilityContext';
import { useToast } from '../context/ToastContext';
import type { ConditionSeverity, ConditionStatus, HealthCondition } from '../types/models';
import { confirmAction } from '../utils/confirm';
import { formatDateOnly, formatDateTime } from '../utils/format';
import { AppText } from './ui/AppText';
import { Button, IconButton } from './ui/Button';
import { Card, Pill } from './ui/Card';
import { DateField, SelectField, TextField } from './ui/Form';
import { screenStyles } from './ui/Screen';
import { Sheet } from './ui/Sheet';
import { ErrorState, LoadingState } from './ui/States';

const STATUSES: { value: ConditionStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'managed', label: 'Managed (under control)' },
  { value: 'resolved', label: 'Resolved' },
];
const SEVERITIES: { value: ConditionSeverity; label: string }[] = [
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
];

export function ConditionsCard({ patientUserId, canEdit = true }: { patientUserId?: string; canEdit?: boolean }) {
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const key = qk.patientConditions(patientUserId ?? 'me');
  const list = useQuery({ queryKey: key, queryFn: () => patientApi.listConditions(patientUserId) });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HealthCondition | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', status: 'active' as ConditionStatus, severity: 'mild' as ConditionSeverity, diagnosedOn: '', notes: '', note: '' });
  const openSheet = (c: HealthCondition | null) => {
    setEditing(c);
    setForm(c ? { name: c.name, status: c.status, severity: c.severity, diagnosedOn: c.diagnosedOn ? c.diagnosedOn.slice(0, 10) : '', notes: c.notes, note: '' } : { name: '', status: 'active', severity: 'mild', diagnosedOn: '', notes: '', note: '' });
    setOpen(true);
  };
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });
  const save = useMutation({
    mutationFn: () => {
      const payload = { name: form.name.trim(), status: form.status, severity: form.severity, diagnosedOn: form.diagnosedOn || null, notes: form.notes, note: form.note };
      return editing ? patientApi.updateCondition(editing._id, payload, patientUserId) : patientApi.addCondition(payload, patientUserId);
    },
    onSuccess: () => {
      toast.success(editing ? 'Condition updated.' : 'Condition added.');
      setOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({ mutationFn: (id: string) => patientApi.deleteCondition(id, patientUserId), onSuccess: () => { toast.success('Condition removed.'); invalidate(); }, onError: (e) => toast.error(errorMessage(e)) });

  const color = (c: HealthCondition) => (c.status === 'resolved' ? colors.success : c.severity === 'severe' ? colors.danger : c.severity === 'moderate' ? colors.warning : colors.teal);

  return (
    <Card>
      <View style={screenStyles.row}>
        <View style={screenStyles.flex}>
          <AppText variant="heading">Health conditions</AppText>
          <AppText variant="caption" tone="faint">
            Track diagnoses, their status and how they change over time.
          </AppText>
        </View>
        {canEdit && <Button title="Add" variant="ghost" icon="add" onPress={() => openSheet(null)} />}
      </View>
      {list.isPending ? (
        <LoadingState />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={list.refetch} />
      ) : (list.data ?? []).length === 0 ? (
        <AppText tone="faint">No conditions tracked yet.</AppText>
      ) : (
        list.data!.map((c) => (
          <View key={c._id} style={screenStyles.gap}>
            <View style={[screenStyles.row, { alignItems: 'center' }]}>
              <View style={screenStyles.flex}>
                <AppText weight="700">{c.name}</AppText>
                <AppText variant="caption" tone="faint">
                  {c.diagnosedOn ? `since ${formatDateOnly(c.diagnosedOn)}` : 'diagnosis date unknown'}
                  {c.notes ? ` · ${c.notes}` : ''}
                </AppText>
              </View>
              <Pill label={`${c.status} · ${c.severity}`} color={color(c)} />
              {canEdit && <IconButton icon="create-outline" accessibilityLabel={`Update ${c.name}`} onPress={() => openSheet(c)} />}
              {canEdit && <IconButton icon="trash-outline" color={colors.danger} accessibilityLabel={`Remove ${c.name}`} onPress={async () => { if (await confirmAction('Remove condition', `Remove ${c.name}?`, 'Remove')) remove.mutate(c._id); }} />}
            </View>
            <Button title={expanded === c._id ? 'Hide history' : `History (${c.updates.length})`} variant="ghost" onPress={() => setExpanded(expanded === c._id ? null : c._id)} />
            {expanded === c._id
              ? c.updates
                  .slice()
                  .reverse()
                  .map((u, i) => (
                    <AppText key={i} variant="caption" tone="muted">
                      {formatDateTime(u.at)} · {u.status ?? ''} {u.severity ? `(${u.severity})` : ''} — {u.note}
                    </AppText>
                  ))
              : null}
          </View>
        ))
      )}

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={editing ? `Update ${editing.name}` : 'Add condition'}
        footer={
          <>
            <Button title="Cancel" variant="secondary" onPress={() => setOpen(false)} style={screenStyles.flex} />
            <Button title="Save" icon="checkmark" disabled={!form.name.trim()} loading={save.isPending} onPress={() => save.mutate()} style={screenStyles.flex} />
          </>
        }
      >
        <TextField label="Condition" required value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Hypertension" autoCapitalize="words" />
        <SelectField label="Status" value={form.status} options={STATUSES} onChange={(v) => setForm((f) => ({ ...f, status: v }))} />
        <SelectField label="Severity" value={form.severity} options={SEVERITIES} onChange={(v) => setForm((f) => ({ ...f, severity: v }))} />
        <DateField label="Diagnosed on" optional value={form.diagnosedOn} onChange={(v) => setForm((f) => ({ ...f, diagnosedOn: v }))} maximumDate={new Date()} />
        <TextField label="Notes" value={form.notes} onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))} multiline />
        {editing && <TextField label="What changed? (added to the history)" value={form.note} onChangeText={(v) => setForm((f) => ({ ...f, note: v }))} placeholder="e.g. BP stable for 3 months" />}
      </Sheet>
    </Card>
  );
}
