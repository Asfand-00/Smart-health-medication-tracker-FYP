/**
 * Caregiver notes — port of pages/CaregiverNotesPage.jsx.
 * Per-patient logbook: list, write (bottom sheet), edit, delete.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { errorMessage } from '../../../api/client';
import { qk } from '../../../api/queryClient';
import { caregiverDashboardApi } from '../../../api/services';
import { PatientSelector, useCaregiverPatients } from '../../../components/PatientSelector';
import { AppText } from '../../../components/ui/AppText';
import { Button, IconButton } from '../../../components/ui/Button';
import { Card, Pill } from '../../../components/ui/Card';
import { SelectField, TextField } from '../../../components/ui/Form';
import { Screen, screenStyles } from '../../../components/ui/Screen';
import { Sheet } from '../../../components/ui/Sheet';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import { useTheme } from '../../../context/AccessibilityContext';
import { useToast } from '../../../context/ToastContext';
import { statusColor } from '../../../theme';
import type { CaregiverNote, NoteSeverity, NoteType } from '../../../types/models';
import { confirmAction } from '../../../utils/confirm';
import { formatDateTime, humanise } from '../../../utils/format';

const NOTE_TYPES: { value: NoteType; label: string }[] = [
  { value: 'general', label: 'General note' },
  { value: 'medication', label: 'Medication log' },
  { value: 'cognitive', label: 'Cognitive status' },
  { value: 'behavioral', label: 'Behavioral observation' },
  { value: 'safety', label: 'Safety check' },
  { value: 'daily_report', label: 'Daily log' },
];
const SEVERITIES: { value: NoteSeverity; label: string }[] = [
  { value: 'low', label: 'Low severity' },
  { value: 'medium', label: 'Medium severity' },
  { value: 'high', label: 'High severity' },
  { value: 'critical', label: 'Critical severity' },
];

export default function NotesScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { query: overview, patients, selectedId, setSelectedId } = useCaregiverPatients();

  const notes = useQuery({
    queryKey: qk.notes(selectedId),
    queryFn: () => caregiverDashboardApi.getNotes(selectedId),
    enabled: Boolean(selectedId),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CaregiverNote | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('general');
  const [severity, setSeverity] = useState<NoteSeverity>('low');

  const openForm = (note: CaregiverNote | null) => {
    setEditing(note);
    setTitle(note?.title ?? '');
    setContent(note?.content ?? '');
    setNoteType(note?.noteType ?? 'general');
    setSeverity(note?.severity ?? 'low');
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = { title: title.trim(), content: content.trim(), noteType, severity };
      return editing
        ? caregiverDashboardApi.updateNote(editing._id, payload)
        : caregiverDashboardApi.addNote({ ...payload, patientUserId: selectedId });
    },
    onSuccess: () => {
      toast.success(editing ? 'Note updated!' : 'Caregiver note added successfully');
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: qk.notes(selectedId) });
      queryClient.invalidateQueries({ queryKey: qk.patientTimeline(selectedId) });
    },
    onError: (e) => toast.error(errorMessage(e) || 'Failed to save caregiver note.'),
  });

  const remove = useMutation({
    mutationFn: caregiverDashboardApi.deleteNote,
    onSuccess: () => {
      toast.success('Note deleted.');
      queryClient.invalidateQueries({ queryKey: qk.notes(selectedId) });
    },
    onError: () => toast.error('Failed to delete note.'),
  });

  if (overview.isPending) return <LoadingState label="Loading patients…" />;
  if (overview.isError && !overview.data) return <ErrorState error={overview.error} onRetry={overview.refetch} />;
  if (patients.length === 0) return <EmptyState icon="people-outline" title="No assigned patients found" />;

  return (
    <Screen onRefresh={() => notes.refetch()}>
      <PatientSelector patients={patients} selectedId={selectedId} onSelect={setSelectedId} />
      <Button title="Write new note" icon="create-outline" onPress={() => openForm(null)} />

      {notes.isPending ? (
        <LoadingState />
      ) : notes.isError ? (
        <ErrorState error={notes.error} onRetry={notes.refetch} />
      ) : notes.data.length === 0 ? (
        <EmptyState icon="document-text-outline" title="No notes written for this patient" />
      ) : (
        notes.data.map((n) => (
          <Card key={n._id} accent={statusColor(colors, n.severity)}>
            <View style={screenStyles.row}>
              <View style={screenStyles.flex}>
                <AppText weight="700">{n.title}</AppText>
                <AppText variant="caption" tone="faint">{formatDateTime(n.createdAt)}</AppText>
              </View>
              <IconButton icon="create-outline" accessibilityLabel={`Edit note ${n.title}`} onPress={() => openForm(n)} />
              <IconButton
                icon="trash-outline"
                color={colors.danger}
                accessibilityLabel={`Delete note ${n.title}`}
                onPress={async () => {
                  if (await confirmAction('Delete note', 'Are you sure you want to delete this note?')) remove.mutate(n._id);
                }}
              />
            </View>
            <AppText tone="muted">{n.content}</AppText>
            <View style={screenStyles.wrap}>
              <Pill label={humanise(n.noteType)} color={colors.primary} />
              <Pill label={n.severity} color={statusColor(colors, n.severity)} />
            </View>
          </Card>
        ))
      )}

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={editing ? '✏️ Edit caregiver note' : '📝 Write new note'}
        footer={
          <>
            <Button title="Cancel" variant="secondary" onPress={() => setOpen(false)} style={screenStyles.flex} />
            <Button title={editing ? 'Save edits' : 'Save note'} icon="save-outline" onPress={() => save.mutate()} disabled={!title.trim() || !content.trim()} loading={save.isPending} style={screenStyles.flex} />
          </>
        }
      >
        <TextField label="Title" required value={title} onChangeText={setTitle} placeholder="e.g. Morning cognitive confusion" />
        <SelectField label="Note type" value={noteType} options={NOTE_TYPES} onChange={setNoteType} />
        <SelectField label="Severity" value={severity} options={SEVERITIES} onChange={setSeverity} />
        <TextField label="Content" required value={content} onChangeText={setContent} placeholder="Explain your patient notes and observations in detail…" multiline />
      </Sheet>
    </Screen>
  );
}
