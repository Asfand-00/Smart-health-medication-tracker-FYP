/**
 * Mood check — port of pages/PatientMoodPage.jsx + components/ui/MoodSelector.jsx.
 * POST /caregiver-dashboard/mood (patient logs own mood), GET .../mood/:patientId.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { errorMessage } from '../../api/client';
import { qk } from '../../api/queryClient';
import { caregiverDashboardApi } from '../../api/services';
import { AccessibilityControls } from '../../components/AccessibilityControls';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card, SectionHeader } from '../../components/ui/Card';
import { TextField } from '../../components/ui/Form';
import { Screen, screenStyles } from '../../components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { useTheme } from '../../context/AccessibilityContext';
import { useCurrentUser } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { radius } from '../../theme';
import type { Mood } from '../../types/models';
import { capitalise, formatDate, formatTime } from '../../utils/format';

const MOODS: { id: Mood; emoji: string; label: string }[] = [
  { id: 'happy', emoji: '😊', label: 'Happy' },
  { id: 'calm', emoji: '😌', label: 'Calm' },
  { id: 'anxious', emoji: '😰', label: 'Anxious' },
  { id: 'confused', emoji: '😕', label: 'Confused' },
  { id: 'agitated', emoji: '😠', label: 'Agitated' },
  { id: 'sad', emoji: '😢', label: 'Sad' },
  { id: 'frustrated', emoji: '😣', label: 'Frustrated' },
];
const EMOJI: Record<string, string> = Object.fromEntries(MOODS.map((m) => [m.id, m.emoji]));

export default function MoodScreen() {
  const user = useCurrentUser();
  const userId = user._id || user.id;
  const theme = useTheme();
  const { colors } = theme;
  const toast = useToast();
  const queryClient = useQueryClient();

  const [mood, setMood] = useState<Mood | null>(null);
  const [energy, setEnergy] = useState(3);
  const [notes, setNotes] = useState('');

  const history = useQuery({ queryKey: qk.mood(userId), queryFn: () => caregiverDashboardApi.getMoodHistory(userId) });

  const log = useMutation({
    mutationFn: () => caregiverDashboardApi.logMood({ patientUserId: userId, mood: mood!, energyLevel: energy, notes }),
    onSuccess: () => {
      toast.success('Mood logged successfully!');
      setMood(null);
      setNotes('');
      queryClient.invalidateQueries({ queryKey: qk.mood(userId) });
    },
    onError: (e) => toast.error(errorMessage(e) || 'Failed to log mood.'),
  });

  return (
    <Screen onRefresh={() => history.refetch()}>
      <AccessibilityControls compact />
      <Card>
        <AppText variant="title" align="center">How are you feeling today?</AppText>
        <AppText tone="faint" align="center">Select the emoji that matches your mood right now.</AppText>
        <View style={styles.grid} accessibilityRole="radiogroup">
          {MOODS.map((m) => {
            const sel = mood === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => setMood(m.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: sel }}
                accessibilityLabel={m.label}
                style={[
                  styles.mood,
                  {
                    backgroundColor: sel ? (theme.highContrast ? '#000' : 'rgba(37,99,235,0.3)') : colors.surfaceAlt,
                    borderColor: sel ? (theme.highContrast ? '#ffff00' : colors.primary) : colors.border,
                  },
                ]}
              >
                <AppText style={styles.emoji}>{m.emoji}</AppText>
                <AppText variant="caption" weight="700" tone={sel ? 'primary' : 'muted'}>
                  {m.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.energyHead}>
          <AppText weight="700">What is your energy level?</AppText>
          <AppText variant="heading" tone="primary">{energy} / 5</AppText>
        </View>
        <View style={screenStyles.row} accessibilityRole="radiogroup">
          {[1, 2, 3, 4, 5].map((lvl) => (
            <Button
              key={lvl}
              title={String(lvl)}
              variant={energy === lvl ? 'primary' : 'secondary'}
              onPress={() => setEnergy(lvl)}
              style={screenStyles.flex}
              accessibilityLabel={`Energy level ${lvl} of 5`}
              accessibilityState={{ selected: energy === lvl }}
            />
          ))}
        </View>

        <TextField label="Optional notes" value={notes} onChangeText={setNotes} placeholder="Write anything you want your caregiver or doctor to know…" multiline />
        <Button title={log.isPending ? 'Saving mood…' : 'Save mood log 💖'} size="lg" disabled={!mood} loading={log.isPending} onPress={() => log.mutate()} />
      </Card>

      <SectionHeader title="Mood history" icon="time-outline" />
      {history.isPending ? (
        <LoadingState />
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={history.refetch} />
      ) : history.data.length === 0 ? (
        <EmptyState icon="happy-outline" title="No moods recorded yet" message="Log your first mood above." />
      ) : (
        history.data.map((item) => (
          <Card key={item._id} style={styles.historyRow}>
            <AppText style={styles.historyEmoji}>{EMOJI[item.mood] ?? '❓'}</AppText>
            <View style={screenStyles.flex}>
              <AppText weight="700">{capitalise(item.mood)}</AppText>
              <AppText variant="caption" tone="faint">
                Energy level: {item.energyLevel}/5{item.loggedBy === 'caregiver' ? ' · logged by caregiver' : ''}
              </AppText>
              {item.notes ? <AppText variant="caption" tone="muted">{item.notes}</AppText> : null}
            </View>
            <View style={styles.when}>
              <AppText variant="caption" tone="faint">{formatDate(item.date, { month: 'short', day: 'numeric' })}</AppText>
              <AppText variant="caption" tone="faint">{formatTime(item.date)}</AppText>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  mood: { width: '30%', minWidth: 92, alignItems: 'center', paddingVertical: 12, borderRadius: radius.lg, borderWidth: 2 },
  emoji: { fontSize: 36, lineHeight: 44 },
  energyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  historyEmoji: { fontSize: 32, lineHeight: 40 },
  when: { alignItems: 'flex-end' },
});
