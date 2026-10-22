import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import type { Frequency, Medication, MedicationPayload, TimeOfDay } from '../types/models';
import { TIMES_OF_DAY } from '../types/models';
import { dateOnlyKey, isDateKey, toDateKey } from '../utils/format';
import { Button } from './ui/Button';
import { ChipGroup, DateField, SelectField, TextField } from './ui/Form';
import { Sheet } from './ui/Sheet';

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom' },
];

function emptyForm(): MedicationPayload {
  return {
    medicineName: '',
    dosage: '',
    frequency: 'daily',
    timeOfDay: [],
    description: '',
    notes: '',
    startDate: toDateKey(new Date()),
    endDate: '',
  };
}

function fromMedication(med: Medication): MedicationPayload {
  return {
    medicineName: med.medicineName,
    dosage: med.dosage,
    frequency: med.frequency,
    timeOfDay: med.timeOfDay ?? [],
    description: med.description ?? '',
    notes: med.notes ?? '',
    startDate: dateOnlyKey(med.startDate),
    endDate: med.endDate ? dateOnlyKey(med.endDate) : '',
  };
}

/**
 * Add / edit medication — shared by the patient (MedicationsPage.jsx) and the
 * caregiver (CaregiverDashboard.jsx medModal). The caregiver form on web has no
 * separate "notes" field, so `showNotes` is off there.
 */
export function MedicationFormSheet({
  visible,
  onClose,
  onSubmit,
  editing,
  title,
  saving,
  showNotes = true,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: MedicationPayload) => void;
  editing: Medication | null;
  title: string;
  saving: boolean;
  showNotes?: boolean;
}) {
  const [form, setForm] = useState<MedicationPayload>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof MedicationPayload, string>>>({});

  useEffect(() => {
    if (visible) {
      setForm(editing ? fromMedication(editing) : emptyForm());
      setErrors({});
    }
  }, [visible, editing]);

  const set = <K extends keyof MedicationPayload>(key: K, value: MedicationPayload[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const toggleTime = (t: TimeOfDay) =>
    set('timeOfDay', form.timeOfDay.includes(t) ? form.timeOfDay.filter((x) => x !== t) : [...form.timeOfDay, t]);

  const submit = () => {
    const next: typeof errors = {};
    if (!form.medicineName.trim()) next.medicineName = 'Medication name is required';
    if (!form.dosage.trim()) next.dosage = 'Dosage is required';
    if (!form.startDate) next.startDate = 'Start date is required';
    else if (!isDateKey(form.startDate)) next.startDate = 'Use a valid date (YYYY-MM-DD)';
    if (form.endDate && !isDateKey(form.endDate)) next.endDate = 'Use a valid date (YYYY-MM-DD)';
    if (form.timeOfDay.length === 0) next.timeOfDay = 'Please select at least one time of day.';
    if (form.endDate && form.startDate && form.endDate < form.startDate) next.endDate = 'End date must be after the start date';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit({ ...form, medicineName: form.medicineName.trim(), dosage: form.dosage.trim() });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button title="Cancel" variant="secondary" onPress={onClose} style={styles.flex} />
          <Button title={editing ? 'Update' : 'Save'} icon="checkmark" onPress={submit} loading={saving} style={styles.flex} />
        </>
      }
    >
      <TextField
        label="Medication name"
        required
        value={form.medicineName}
        onChangeText={(v) => set('medicineName', v)}
        placeholder="e.g. Aspirin"
        error={errors.medicineName}
        autoCapitalize="words"
      />
      <TextField
        label="Dosage"
        required
        value={form.dosage}
        onChangeText={(v) => set('dosage', v)}
        placeholder="e.g. 1 tablet, 500mg"
        error={errors.dosage}
      />
      <SelectField label="Frequency" required value={form.frequency} options={FREQUENCIES} onChange={(v) => set('frequency', v)} />
      <ChipGroup
        label="Time of day (select all that apply)"
        required
        multiple
        options={TIMES_OF_DAY.map((t) => ({ value: t, label: t }))}
        selected={form.timeOfDay}
        onToggle={toggleTime}
        error={errors.timeOfDay}
      />
      <DateField label="Start date" required value={form.startDate} onChange={(v) => set('startDate', v)} error={errors.startDate} />
      <DateField label="End date (optional)" optional value={form.endDate} onChange={(v) => set('endDate', v)} error={errors.endDate} />
      <TextField
        label={showNotes ? 'Drug information / description' : 'Instructions / description'}
        value={form.description}
        onChangeText={(v) => set('description', v)}
        placeholder={showNotes ? 'What is this medication for?' : 'e.g. Take after meals'}
        multiline
      />
      {showNotes && (
        <TextField
          label="Doctor instructions / notes"
          value={form.notes}
          onChangeText={(v) => set('notes', v)}
          placeholder="e.g. Take after meals with water"
          multiline
        />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
