/**
 * AI insights — GET /ai/insights: missed-dose predictions per dose slot,
 * behavioural patterns, risk flags for irregular habits, personalised
 * recommendations (with one-tap apply for reminder-time changes), and the
 * history of preventive alerts the system raised.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { errorMessage } from '../api/client';
import { qk } from '../api/queryClient';
import { aiApi, smartReminderApi } from '../api/services';
import { PatientPicker, usePatientContext } from '../components/PatientContext';
import { RiskBadge } from '../components/RiskBadge';
import { AppText } from '../components/ui/AppText';
import { Button } from '../components/ui/Button';
import { Card, Pill, SectionHeader, StatTile } from '../components/ui/Card';
import { BarChart, Meter } from '../components/ui/Charts';
import { Screen, screenStyles } from '../components/ui/Screen';
import { ErrorState, LoadingState } from '../components/ui/States';
import { useTheme } from '../context/AccessibilityContext';
import { useToast } from '../context/ToastContext';
import { statusColor } from '../theme';
import type { AiRecommendation } from '../types/models';
import { formatDate, formatDateTime } from '../utils/format';

export default function AiInsightsScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const ctx = usePatientContext();

  const insights = useQuery({ queryKey: qk.aiInsights(ctx.patientId), queryFn: () => aiApi.insights(ctx.patientParam), enabled: Boolean(ctx.patientId) });
  const alerts = useQuery({ queryKey: qk.aiAlerts(ctx.patientId), queryFn: () => aiApi.alerts(ctx.patientParam), enabled: Boolean(ctx.patientId) });

  const run = useMutation({
    mutationFn: () => aiApi.run(ctx.patientParam),
    onSuccess: (r) => {
      toast.success(r.created ? `${r.created} preventive alert${r.created === 1 ? '' : 's'} raised.` : 'No new alerts — nothing above the risk threshold right now.');
      queryClient.invalidateQueries({ queryKey: ['ai'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const applyTime = useMutation({
    mutationFn: (a: AiRecommendation) => smartReminderApi.applySuggestion(a.action.timeOfDay!, a.action.suggestedTime!),
    onSuccess: (_d, a) => {
      toast.success(`${a.action.timeOfDay} reminder moved to ${a.action.suggestedTime}.`);
      queryClient.invalidateQueries({ queryKey: ['smartReminders'] });
      queryClient.invalidateQueries({ queryKey: ['ai'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const d = insights.data;
  const pct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v * 100)}%`);

  return (
    <Screen onRefresh={() => Promise.all([insights.refetch(), alerts.refetch()])}>
      <PatientPicker ctx={ctx} />
      {!ctx.patientId ? null : insights.isPending ? (
        <LoadingState label="Analysing medication history…" />
      ) : insights.isError ? (
        <ErrorState error={insights.error} onRetry={insights.refetch} />
      ) : d ? (
        <>
          <Card accent={statusColor(colors, d.summary.riskLevel)}>
            <View style={screenStyles.row}>
              <AppText variant="heading" style={screenStyles.flex}>
                {d.summary.headline}
              </AppText>
              <RiskBadge level={d.summary.riskLevel} score={d.summary.riskScore} />
            </View>
            <AppText variant="caption" tone="faint">
              Rule-based analysis of the last {d.lookbackDays} days ({d.behavior.sampleSize} dose records) · {formatDateTime(d.generatedAt)}
            </AppText>
            {!d.enabled ? <Pill label="AI alerts disabled by administrator" color={colors.warning} /> : null}
          </Card>

          <View style={screenStyles.wrap}>
            <StatTile label="Adherence" value={d.behavior.adherenceRate == null ? '—' : `${d.behavior.adherenceRate}%`} sub={`${d.summary.trend}`} icon="trending-up-outline" color={colors.primary} />
            <StatTile label="Highest miss risk" value={pct(d.summary.highestMissProbability)} sub="next doses" icon="warning-outline" color={colors.orange} />
            <StatTile label="Current streak" value={`${d.behavior.currentStreak}d`} sub={`best ${d.behavior.longestStreak}d`} icon="flame-outline" color={colors.success} />
            <StatTile label="Consistency" value={d.behavior.consistencyScore == null ? '—' : `${d.behavior.consistencyScore}%`} sub="fully adherent days" icon="checkmark-done-outline" color={colors.teal} />
          </View>

          <SectionHeader title="Missed-dose predictions" icon="telescope-outline" />
          {d.predictions.predictions.length === 0 ? (
            <Card>
              <AppText tone="faint">No active medications to predict for.</AppText>
            </Card>
          ) : (
            d.predictions.predictions.map((p) => (
              <Card key={`${p.medicationId}-${p.timeOfDay}`} accent={statusColor(colors, p.riskLevel)}>
                <View style={screenStyles.row}>
                  <View style={screenStyles.flex}>
                    <AppText weight="700">
                      {p.medicineName} · {p.timeOfDay}
                    </AppText>
                    <AppText variant="caption" tone="faint">
                      Next due {formatDate(p.nextDue, { weekday: 'short', day: 'numeric', month: 'short' })} · {p.sampleSize} past doses
                    </AppText>
                  </View>
                  <AppText variant="title" color={statusColor(colors, p.riskLevel)}>
                    {pct(p.probability)}
                  </AppText>
                </View>
                <Meter label="Chance of missing" value={p.probability * 100} color={statusColor(colors, p.riskLevel)} />
                {p.reasons.map((r, i) => (
                  <AppText key={i} variant="caption" tone="muted">
                    • {r}
                  </AppText>
                ))}
              </Card>
            ))
          )}

          <SectionHeader title="Risk detection" icon="shield-half-outline" />
          {d.risks.flags.length === 0 ? (
            <Card>
              <AppText tone="success" weight="600">
                ✓ No irregular habits detected.
              </AppText>
            </Card>
          ) : (
            d.risks.flags.map((f, i) => (
              <Card key={i} accent={statusColor(colors, f.severity)}>
                <View style={screenStyles.row}>
                  <AppText weight="700" style={screenStyles.flex}>
                    {f.title}
                  </AppText>
                  <Pill label={f.severity} color={statusColor(colors, f.severity)} />
                </View>
                <AppText variant="caption" tone="muted">
                  {f.detail}
                </AppText>
                <AppText variant="caption">💡 {f.recommendation}</AppText>
              </Card>
            ))
          )}

          <SectionHeader title="Behavioural patterns" icon="analytics-outline" />
          <Card>
            <AppText variant="label" tone="faint">
              Missed doses by time of day
            </AppText>
            <BarChart data={d.behavior.bySlot.map((s) => ({ label: s.slot, value: s.missRate == null ? null : s.missRate * 100, sub: `${s.missed}/${s.total}` }))} color={(v) => (v >= 50 ? colors.danger : v >= 25 ? colors.warning : colors.success)} />
            <AppText variant="label" tone="faint">
              Missed doses by weekday
            </AppText>
            <BarChart data={d.behavior.byWeekday.map((w) => ({ label: w.day, value: w.missRate == null ? null : w.missRate * 100, sub: `${w.missed}/${w.total}` }))} color={(v) => (v >= 50 ? colors.danger : v >= 25 ? colors.warning : colors.success)} />
            {d.behavior.avgResponseMinutes != null ? <AppText variant="caption" tone="muted">Reminders are acknowledged after {d.behavior.avgResponseMinutes} min on average.</AppText> : null}
            {d.behavior.weekendEffect.weekendMissRate != null ? <AppText variant="caption" tone="muted">Weekend miss rate {pct(d.behavior.weekendEffect.weekendMissRate)} vs weekdays {pct(d.behavior.weekendEffect.weekdayMissRate)}.</AppText> : null}
            {d.behavior.moodCorrelation.badMoodDays > 0 ? <AppText variant="caption" tone="muted">On low-mood days {pct(d.behavior.moodCorrelation.badMoodMissRate)} of doses were missed vs {pct(d.behavior.moodCorrelation.otherMissRate)} otherwise.</AppText> : null}
            {d.behavior.insights.map((i, idx) => (
              <View key={idx} style={screenStyles.row}>
                <Pill label={i.severity} color={statusColor(colors, i.severity)} />
                <View style={screenStyles.flex}>
                  <AppText weight="600">{i.title}</AppText>
                  <AppText variant="caption" tone="faint">
                    {i.detail}
                  </AppText>
                </View>
              </View>
            ))}
          </Card>

          <SectionHeader title="Personalised recommendations" icon="bulb-outline" />
          {d.recommendations.map((r, i) => (
            <Card key={i} accent={r.priority === 'high' ? colors.danger : r.priority === 'medium' ? colors.warning : colors.success}>
              <AppText weight="700">{r.title}</AppText>
              <AppText variant="caption" tone="muted">
                {r.detail}
              </AppText>
              {ctx.isSelf && r.action.type === 'adjust_reminder_time' && r.action.suggestedTime ? (
                <Button title={`Move ${r.action.timeOfDay} reminder to ${r.action.suggestedTime}`} icon="time-outline" variant="secondary" onPress={() => applyTime.mutate(r)} loading={applyTime.isPending && applyTime.variables === r} />
              ) : null}
              {ctx.isSelf && r.action.type === 'adjust_reminder_time' && !r.action.suggestedTime ? <Button title="Change reminder times" icon="time-outline" variant="secondary" onPress={() => router.push('/today')} /> : null}
              {ctx.isSelf && r.action.type === 'enable_channels' ? <Button title="Open notification settings" icon="notifications-outline" variant="secondary" onPress={() => router.push('/notification-settings')} /> : null}
              {r.action.type === 'doctor_review' ? <Button title="Check drug information" icon="book-outline" variant="secondary" onPress={() => router.push({ pathname: '/drug-info', params: ctx.patientParam ? { patientId: ctx.patientParam } : {} })} /> : null}
            </Card>
          ))}

          <SectionHeader title="Preventive alerts" icon="notifications-circle-outline" action={<Button title="Run check now" variant="ghost" icon="refresh" onPress={() => run.mutate()} loading={run.isPending} />} />
          {alerts.isPending ? (
            <LoadingState />
          ) : (alerts.data ?? []).length === 0 ? (
            <Card>
              <AppText tone="faint">No preventive alerts raised yet. The system checks every hour and warns before a dose is likely to be missed.</AppText>
            </Card>
          ) : (
            alerts.data!.slice(0, 15).map((a) => (
              <Card key={a._id} accent={statusColor(colors, a.severity)}>
                <View style={screenStyles.row}>
                  <AppText weight="700" style={screenStyles.flex}>
                    {a.title}
                  </AppText>
                  {a.kind === 'missed_dose_prediction' ? <Pill label={a.outcome === 'pending' ? `${pct(a.probability)} risk` : `outcome: ${a.outcome}`} color={a.outcome === 'taken' ? colors.success : a.outcome === 'pending' ? colors.warning : colors.danger} /> : null}
                </View>
                <AppText variant="caption" tone="faint">
                  {a.date} · {formatDateTime(a.createdAt)} · {a.notifiedCareCircle ? 'care team notified' : 'patient notified'}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {a.message}
                </AppText>
              </Card>
            ))
          )}
        </>
      ) : null}
    </Screen>
  );
}
