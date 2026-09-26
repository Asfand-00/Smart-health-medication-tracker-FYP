/**
 * Reports & risk hub — port of pages/ReportsPage.jsx (patient and caregiver).
 *
 * Deviations from web, both towards real data:
 *  - the web "Compliance Trend Visualizer" draws hard-coded bar heights; here
 *    the chart uses the patient's real 7-day data from GET /adherence/weekly
 *  - the web passes `risk=` to RiskBadge, which reads `level`, so it always
 *    shows "Low Risk"; here the real overall risk is shown
 */
import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';

import { qk } from '../api/queryClient';
import { adherenceApi, reportsApi } from '../api/services';
import { ExportActions } from '../components/ExportActions';
import { PatientSelector, useCaregiverPatients } from '../components/PatientSelector';
import { RiskBadge } from '../components/RiskBadge';
import { AppText } from '../components/ui/AppText';
import { Card, Pill, SectionHeader, StatTile } from '../components/ui/Card';
import { AdherenceBarChart, Meter } from '../components/ui/Charts';
import { Screen, screenStyles } from '../components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { useTheme } from '../context/AccessibilityContext';
import { useCurrentUser } from '../context/AuthContext';
import { endOfDay, fromDateOnly, humanise } from '../utils/format';

async function loadReports(patientId: string) {
  const [adherence, meds, risk, weekly] = await Promise.allSettled([
    reportsApi.getAdherence(patientId),
    reportsApi.getMedications(patientId),
    reportsApi.getRiskAnalysis(patientId),
    adherenceApi.getWeekly(patientId),
  ]);
  const value = <T,>(r: PromiseSettledResult<T>) => (r.status === 'fulfilled' ? r.value : null);
  if ([adherence, meds, risk, weekly].every((r) => r.status === 'rejected')) {
    throw (adherence as PromiseRejectedResult).reason;
  }
  return { adherence: value(adherence), meds: value(meds), risk: value(risk), weekly: value(weekly) };
}

export default function ReportsScreen() {
  const user = useCurrentUser();
  const isCaregiver = user.role === 'caregiver';
  const { colors } = useTheme();
  const caregiver = useCaregiverPatients(undefined, isCaregiver);
  const patientId = isCaregiver ? caregiver.selectedId : user._id || user.id;

  const reports = useQuery({
    queryKey: qk.reports(patientId),
    queryFn: () => loadReports(patientId),
    enabled: Boolean(patientId),
  });

  if (isCaregiver) {
    if (caregiver.query.isPending) return <LoadingState label="Loading patients…" />;
    if (caregiver.query.isError && !caregiver.query.data) return <ErrorState error={caregiver.query.error} onRetry={caregiver.query.refetch} />;
    if (caregiver.patients.length === 0) return <EmptyState icon="people-outline" title="No assigned patients found" />;
  }

  const d = reports.data;
  const today = new Date();

  return (
    <Screen onRefresh={() => reports.refetch()}>
      {isCaregiver && <PatientSelector patients={caregiver.patients} selectedId={caregiver.selectedId} onSelect={caregiver.setSelectedId} />}
      <AppText tone="muted">Adherence insights, medication plans and active medical risk evaluations.</AppText>
      <ExportActions patientId={patientId} />

      {reports.isPending ? (
        <LoadingState label="Loading reports…" />
      ) : reports.isError ? (
        <ErrorState error={reports.error} onRetry={reports.refetch} />
      ) : d ? (
        <>
          {d.adherence && (
            <View style={screenStyles.wrap}>
              <StatTile label="Adherence rate" value={`${d.adherence.adherenceRate}%`} sub="Compliance status" color={colors.primary} icon="checkmark-done-outline" />
              <StatTile label="Total scheduled" value={d.adherence.totalDoses} sub="Doses registered" color={colors.teal} icon="calendar-outline" />
              <StatTile label="Taken / delayed" value={d.adherence.takenDoses + d.adherence.delayedDoses} sub="Doses confirmed" color={colors.success} icon="medkit-outline" />
              <StatTile label="Missed / skipped" value={d.adherence.missedDoses + d.adherence.skippedDoses} sub="Doses failed/skipped" color={colors.danger} icon="close-circle-outline" />
            </View>
          )}

          {d.weekly && (
            <>
              <SectionHeader title="Compliance trend (last 7 days)" icon="trending-up-outline" />
              <Card>
                <AdherenceBarChart data={d.weekly.dailyData} />
              </Card>
            </>
          )}

          <SectionHeader title="Medication plan statistics" icon="layers-outline" />
          {!d.meds || d.meds.medications.length === 0 ? (
            <Card>
              <AppText tone="faint">No medications registered under this user.</AppText>
            </Card>
          ) : (
            d.meds.medications.map((m) => {
              const active = !m.endDate || endOfDay(fromDateOnly(m.endDate)) >= today;
              return (
                <Card key={m._id}>
                  <View style={screenStyles.row}>
                    <AppText weight="700" style={screenStyles.flex}>{m.medicineName}</AppText>
                    <Pill label={active ? 'Active' : 'Ended'} color={active ? colors.success : colors.textFaint} />
                  </View>
                  <AppText variant="caption" tone="faint">
                    Dosage: {m.dosage} | Frequency: {m.frequency}
                  </AppText>
                  <AppText variant="caption" tone="muted">Reminder timings: {m.timeOfDay.join(', ')}</AppText>
                </Card>
              );
            })
          )}

          <SectionHeader title="Medical risk analysis" icon="warning-outline" />
          <Card>
            {d.risk ? (
              <>
                <AppText variant="caption" tone="faint">Computed from daily compliance logs & cognitive tests.</AppText>
                <View style={screenStyles.row}>
                  <AppText tone="muted" style={screenStyles.flex}>Overall risk level</AppText>
                  <RiskBadge level={d.risk.overallRisk} />
                </View>
                <Meter label="Adherence" value={d.risk.adherenceRisk} color={colors.primary} />
                <Meter label="Cognitive" value={d.risk.cognitiveRisk} color={colors.warning} />
                <Meter label="Behavioral" value={d.risk.behavioralRisk} color={colors.purple} />
                {d.risk.factors.length > 0 && (
                  <View style={screenStyles.gap}>
                    <AppText variant="label" tone="faint">Contributing risk factors</AppText>
                    {d.risk.factors.map((f, i) => (
                      <AppText key={i} variant="caption" tone="muted">
                        ⚠️ {f.factor} — {f.description}
                      </AppText>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <AppText tone="faint">Risk analysis is unavailable right now.</AppText>
            )}
          </Card>

          <SectionHeader title="Recent tests & signs" icon="pulse-outline" />
          <Card>
            {!d.risk || d.risk.recentAssessments.length === 0 ? (
              <AppText tone="faint">No tests recorded yet.</AppText>
            ) : (
              d.risk.recentAssessments.slice(0, 3).map((a) => (
                <View key={a._id} style={screenStyles.gap}>
                  <View style={screenStyles.row}>
                    <AppText weight="600" style={screenStyles.flex}>{humanise(a.assessmentType)}</AppText>
                    <AppText weight="700">{a.score}/40</AppText>
                  </View>
                  {a.observations ? <AppText variant="caption" tone="faint">"{a.observations}"</AppText> : null}
                </View>
              ))
            )}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
