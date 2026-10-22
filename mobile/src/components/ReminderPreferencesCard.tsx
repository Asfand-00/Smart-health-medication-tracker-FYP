/**
 * Adaptive reminder timing — per-slot clock times (GET/PUT
 * /smart-reminders/preferences) and the system's suggestions based on when
 * the patient actually responds (GET /smart-reminders/suggestions).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { errorMessage } from '../api/client';
import { qk } from '../api/queryClient';
import { smartReminderApi } from '../api/services';
import { useTheme } from '../context/AccessibilityContext';
import { useToast } from '../context/ToastContext';
import type { TimeOfDay } from '../types/models';
import { TIMES_OF_DAY } from '../types/models';
import { AppText } from './ui/AppText';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { TextField } from './ui/Form';
import { screenStyles } from './ui/Screen';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const pad = (n: number) => String(n).padStart(2, '0');

export function ReminderPreferencesCard() {
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const prefs = useQuery({ queryKey: qk.reminderPreferences, queryFn: smartReminderApi.getPreferences });
  const suggestions = useQuery({ queryKey: qk.reminderSuggestions, queryFn: smartReminderApi.getSuggestions });
  const [times, setTimes] = useState<Record<TimeOfDay, string>>({ Morning: '', Afternoon: '', Evening: '', Night: '' });
  const [lead, setLead] = useState('0');
  const [errors, setErrors] = useState<Partial<Record<TimeOfDay, string>>>({});
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (prefs.data) {
      const eff = prefs.data.effective;
      setTimes({
        Morning: `${pad(eff.Morning.hour)}:${pad(eff.Morning.minute)}`,
        Afternoon: `${pad(eff.Afternoon.hour)}:${pad(eff.Afternoon.minute)}`,
        Evening: `${pad(eff.Evening.hour)}:${pad(eff.Evening.minute)}`,
        Night: `${pad(eff.Night.hour)}:${pad(eff.Night.minute)}`,
      });
      setLead(String(prefs.data.reminderLeadMinutes));
    }
  }, [prefs.data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['smartReminders'] });
  };
  const save = useMutation({
    mutationFn: () => smartReminderApi.updatePreferences({ reminderTimes: times, reminderLeadMinutes: Number(lead) || 0 }),
    onSuccess: () => {
      toast.success("Reminder times saved. Today's pending reminders were re-timed.");
      setEditing(false);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const apply = useMutation({
    mutationFn: (s: { timeOfDay: TimeOfDay; suggestedTime: string }) => smartReminderApi.applySuggestion(s.timeOfDay, s.suggestedTime),
    onSuccess: (_d, s) => {
      toast.success(`${s.timeOfDay} reminder moved to ${s.suggestedTime}.`);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submit = () => {
    const next: typeof errors = {};
    TIMES_OF_DAY.forEach((t) => {
      if (!TIME_RE.test(times[t])) next[t] = 'HH:MM';
    });
    setErrors(next);
    if (Object.keys(next).length === 0) save.mutate();
  };

  return (
    <Card>
      <View style={screenStyles.row}>
        <View style={screenStyles.flex}>
          <AppText variant="heading">⏱️ Reminder times</AppText>
          <AppText variant="caption" tone="faint">
            When each daily reminder fires. The system suggests changes when you often confirm late.
          </AppText>
        </View>
        {!editing && <Button title="Edit" variant="ghost" icon="create-outline" onPress={() => setEditing(true)} />}
      </View>
      {prefs.isPending ? null : (
        <View style={screenStyles.wrap}>
          {TIMES_OF_DAY.map((t) => (
            <View key={t} style={{ minWidth: 140, flex: 1 }}>
              <TextField label={t} value={times[t]} onChangeText={(v) => setTimes((x) => ({ ...x, [t]: v }))} editable={editing} placeholder="08:00" error={errors[t]} keyboardType="numbers-and-punctuation" />
            </View>
          ))}
        </View>
      )}
      {editing && (
        <>
          <TextField label="Notify minutes before" value={lead} onChangeText={setLead} keyboardType="numeric" hint="0 = exactly at the time" />
          <View style={screenStyles.row}>
            <Button title="Cancel" variant="secondary" onPress={() => { setEditing(false); prefs.refetch(); }} style={screenStyles.flex} />
            <Button title="Save times" icon="save-outline" onPress={submit} loading={save.isPending} style={screenStyles.flex} />
          </View>
        </>
      )}
      {suggestions.data?.suggestions.length ? (
        <View style={screenStyles.gap}>
          <AppText variant="label" color={colors.warning}>
            Adaptive suggestions
          </AppText>
          {suggestions.data.suggestions.map((s) => (
            <View key={s.timeOfDay} style={screenStyles.gap}>
              <AppText variant="caption" tone="muted">
                {s.reason}
              </AppText>
              <Button title={`Move ${s.timeOfDay} from ${s.currentScheduledTime} to ${s.suggestedTime}`} icon="time-outline" variant="warning" onPress={() => apply.mutate(s)} loading={apply.isPending && apply.variables?.timeOfDay === s.timeOfDay} />
            </View>
          ))}
        </View>
      ) : suggestions.data ? (
        <AppText variant="caption" tone="faint">
          {suggestions.data.message}
        </AppText>
      ) : null}
    </Card>
  );
}
