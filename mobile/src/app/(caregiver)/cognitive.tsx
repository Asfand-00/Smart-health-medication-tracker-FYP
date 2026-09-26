/**
 * Cognitive status — port of pages/CognitiveAssessmentPage.jsx.
 * Four 0–10 domain scores (steppers instead of range sliders), composite /40,
 * POST /caregiver-dashboard/cognitive-assessment, history with decline %.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { errorMessage } from '../../api/client';
import { qk } from '../../api/queryClient';
import { caregiverDashboardApi } from '../../api/services';
import { PatientSelector, useCaregiverPatients } from '../../components/PatientSelector';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card, Pill, SectionHeader } from '../../components/ui/Card';
import { SelectField, Stepper, TextField } from '../../components/ui/Form';
import { Screen, screenStyles } from '../../components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { useTheme } from '../../context/AccessibilityContext';
import { useToast } from '../../context/ToastContext';
import type { AssessmentType, UserRef } from '../../types/models';
import { formatDate, humanise } from '../../utils/format';

const TYPES: { value: AssessmentType; label: string }[] = [
  { value: 'general', label: 'Daily cognitive checkup' },
  { value: 'mini_mental', label: 'MMSE (Mini-Mental State Exam)' },
  { value: 'clock_drawing', label: 'Clock drawing test' },
  { value: 'verbal_fluency', label: 'Verbal fluency test' },
  { value: 'memory_recall', label: 'Three-word recall' },
];

export default function CognitiveScreen() {
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { query: overview, patients, selectedId, setSelectedId, selected } = useCaregiverPatients(patientId);

  const assessments = useQuery({
    queryKey: qk.cognitive(selectedId),
    queryFn: () => caregiverDashboardApi.getCognitiveAssessments(selectedId),
    enabled: Boolean(selectedId),
  });

  const [type, setType] = useState<AssessmentType>('general');
  const [memory, setMemory] = useState(10);
  const [orientation, setOrientation] = useState(10);
  const [language, setLanguage] = useState(10);
  const [attention, setAttention] = useState(10);
  const [observations, setObservations] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const total = memory + orientation + language + attention;

  const classify = (score: number) =>
    score >= 32
      ? { text: 'Normal / mild', color: colors.success }
      : score >= 20
        ? { text: 'Moderate decline', color: colors.warning }
        : { text: 'Severe decline', color: colors.danger };

  const submit = useMutation({
    mutationFn: () =>
      caregiverDashboardApi.logCognitiveAssessment({
        patientUserId: selectedId,
        assessmentType: type,
        memoryScore: memory,
        orientationScore: orientation,
        languageScore: language,
        attentionScore: attention,
        score: total,
        maxScore: 40,
        observations,
        recommendations,
      }),
    onSuccess: () => {
      toast.success('Cognitive assessment logged successfully!');
      setObservations('');
      setRecommendations('');
      setMemory(10);
      setOrientation(10);
      setLanguage(10);
      setAttention(10);
      setType('general');
      queryClient.invalidateQueries({ queryKey: qk.cognitive(selectedId) });
      queryClient.invalidateQueries({ queryKey: qk.caregiverOverview });
    },
    onError: (e) => toast.error(errorMessage(e) || 'Failed to log assessment.'),
  });

  if (overview.isPending) return <LoadingState label="Loading patient list…" />;
  if (overview.isError && !overview.data) return <ErrorState error={overview.error} onRetry={overview.refetch} />;
  if (patients.length === 0) return <EmptyState icon="people-outline" title="No assigned patients found" />;

  const cls = classify(total);

  return (
    <Screen onRefresh={() => assessments.refetch()}>
      <PatientSelector
        patients={patients}
        selectedId={selectedId}
        onSelect={setSelectedId}
        renderMeta={(p) => (p.latestCognitive ? `Last score ${p.latestCognitive.score}/40` : null)}
      />

      <SectionHeader title="Log cognitive assessment" icon="pulse-outline" />
      <Card>
        <AppText variant="caption" tone="faint">
          Evaluate {selected ? `${selected.firstName}'s` : "the patient's"} cognitive state across 4 main areas.
        </AppText>
        <SelectField label="Assessment type" value={type} options={TYPES} onChange={setType} />
        <AppText variant="label" tone="faint">Domain performance (0–10 points)</AppText>
        <Stepper label="Short-term memory recall" value={memory} min={0} max={10} onChange={setMemory} description="Ability to recall recent items, medication purposes, or current events." />
        <Stepper label="Temporal & spatial orientation" value={orientation} min={0} max={10} onChange={setOrientation} description="Awareness of time (day, month, hour) and place." />
        <Stepper label="Language & comprehension" value={language} min={0} max={10} onChange={setLanguage} description="Understanding instructions, finding words, expressing thoughts." />
        <Stepper label="Concentration & attention" value={attention} min={0} max={10} onChange={setAttention} description="Focusing on simple tasks, counting, spelling backwards." />
        <TextField label="Observations / signs of confusion" value={observations} onChangeText={setObservations} placeholder="Verbal repetitions, disorientation signs, triggers…" multiline />
        <TextField label="Recommendations / coping actions" value={recommendations} onChangeText={setRecommendations} placeholder="e.g. Increase visual cue cards…" multiline />
        <View style={styles.total} accessible accessibilityLabel={`Total composite score ${total} of 40, ${cls.text}`}>
          <AppText weight="700">Total composite score</AppText>
          <AppText variant="title">{total} / 40</AppText>
          <Pill label={cls.text} color={cls.color} />
        </View>
        <Button title={submit.isPending ? 'Logging…' : 'Save assessment log'} size="lg" onPress={() => submit.mutate()} loading={submit.isPending} disabled={!selectedId} />
      </Card>

      <SectionHeader title="Assessment history" icon="trending-up-outline" />
      {assessments.isPending ? (
        <LoadingState />
      ) : assessments.isError ? (
        <ErrorState error={assessments.error} onRetry={assessments.refetch} />
      ) : assessments.data.length === 0 ? (
        <EmptyState icon="bulb-outline" title="No assessments logged for this patient" />
      ) : (
        assessments.data.map((a) => {
          const c = classify(a.score);
          const change = a.declineFromPrevious;
          const assessor = a.assessedBy && typeof a.assessedBy === 'object' ? (a.assessedBy as UserRef) : null;
          return (
            <Card key={a._id} accent={c.color}>
              <View style={screenStyles.row}>
                <View style={screenStyles.flex}>
                  <AppText weight="700">{humanise(a.assessmentType)}</AppText>
                  <AppText variant="caption" tone="faint">{formatDate(a.assessmentDate)}</AppText>
                </View>
                <AppText variant="title">{a.score}/40</AppText>
              </View>
              <View style={styles.domains}>
                {[
                  ['Mem', a.memoryScore],
                  ['Ori', a.orientationScore],
                  ['Lan', a.languageScore],
                  ['Att', a.attentionScore],
                ].map(([k, v]) => (
                  <View key={k as string} style={[styles.domain, { backgroundColor: colors.surfaceAlt }]}>
                    <AppText variant="caption" tone="faint">{k}</AppText>
                    <AppText weight="700">{v ?? '—'}</AppText>
                  </View>
                ))}
              </View>
              {a.observations ? <AppText variant="caption" tone="muted">Observations: {a.observations}</AppText> : null}
              {a.recommendations ? <AppText variant="caption" tone="muted">Recommendations: {a.recommendations}</AppText> : null}
              <View style={styles.foot}>
                <AppText variant="caption" tone="faint">
                  Assessor: {assessor?.firstName ?? '—'} ({a.assessedByRole})
                </AppText>
                {change !== null && (
                  <Pill
                    label={change > 0 ? `↓ Decline ${change}%` : change < 0 ? `↑ Growth ${Math.abs(change)}%` : 'No change'}
                    color={change > 0 ? colors.danger : change < 0 ? colors.success : colors.textFaint}
                  />
                )}
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  total: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  domains: { flexDirection: 'row', gap: 8 },
  domain: { flex: 1, alignItems: 'center', borderRadius: 8, paddingVertical: 6 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
});
