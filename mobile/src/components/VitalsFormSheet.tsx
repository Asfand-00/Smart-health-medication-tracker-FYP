import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { VitalsPayload } from '../types/models';
import { numberOrUndefined } from '../utils/format';
import { Button } from './ui/Button';
import { TextField } from './ui/Form';
import { Sheet } from './ui/Sheet';

const EMPTY = { systolic: '', diastolic: '', heartRate: '', bloodSugar: '', weight: '', oxygenLevel: '', note: '' };
type FormState = typeof EMPTY;

/**
 * Record vitals — used by the Vitals screen (VitalsPage.jsx) and the once-a-day
 * prompt on the patient home screen (DailyVitalsModal.jsx, `daily` variant).
 */
export function VitalsFormSheet({
  visible,
  onClose,
  onSubmit,
  saving,
  daily = false,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: VitalsPayload) => void;
  saving: boolean;
  daily?: boolean;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (visible) {
      setForm(EMPTY);
      setError(undefined);
    }
  }, [visible]);

  const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    const numericKeys: (keyof FormState)[] = ['systolic', 'diastolic', 'heartRate', 'bloodSugar', 'weight', 'oxygenLevel'];
    const invalid = numericKeys.find((k) => form[k].trim() && numberOrUndefined(form[k]) === undefined);
    if (invalid) {
      setError('Please enter numbers only.');
      return;
    }
    if (numericKeys.every((k) => !form[k].trim())) {
      setError('Enter at least one reading.');
      return;
    }
    setError(undefined);
    onSubmit({
      bloodPressure: { systolic: numberOrUndefined(form.systolic), diastolic: numberOrUndefined(form.diastolic) },
      heartRate: numberOrUndefined(form.heartRate),
      bloodSugar: numberOrUndefined(form.bloodSugar),
      weight: numberOrUndefined(form.weight),
      oxygenLevel: numberOrUndefined(form.oxygenLevel),
      note: form.note.trim() || undefined,
    });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={daily ? 'Daily Health Check' : 'New Health Entry'}
      subtitle={daily ? 'Record your vitals for today' : "Track your body's vital signs"}
      footer={
        <>
          <Button title={daily ? 'Skip for now' : 'Cancel'} variant="secondary" onPress={onClose} style={styles.flex} />
          <Button title="Save vitals" icon="pulse" onPress={submit} loading={saving} style={styles.flex} />
        </>
      }
    >
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField label="Systolic (top)" value={form.systolic} onChangeText={set('systolic')} placeholder="120" keyboardType="numeric" hint="mmHg" />
        </View>
        <View style={styles.flex}>
          <TextField label="Diastolic (bottom)" value={form.diastolic} onChangeText={set('diastolic')} placeholder="80" keyboardType="numeric" hint="mmHg" />
        </View>
      </View>
      <TextField label="Heart rate (bpm)" value={form.heartRate} onChangeText={set('heartRate')} placeholder="72" keyboardType="numeric" />
      <TextField label="Blood sugar (mg/dL)" value={form.bloodSugar} onChangeText={set('bloodSugar')} placeholder="95" keyboardType="numeric" />
      <TextField label="Weight (kg)" value={form.weight} onChangeText={set('weight')} placeholder="70" keyboardType="decimal-pad" />
      <TextField label="Oxygen (SpO2 %)" value={form.oxygenLevel} onChangeText={set('oxygenLevel')} placeholder="98" keyboardType="numeric" />
      <TextField
        label="Note (optional)"
        value={form.note}
        onChangeText={set('note')}
        placeholder={daily ? 'How are you feeling today?' : 'e.g. Feeling a bit tired today'}
        multiline
        error={error}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 12 },
});
