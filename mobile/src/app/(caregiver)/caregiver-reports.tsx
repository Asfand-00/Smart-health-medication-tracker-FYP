/**
 * Caregiver reports & risk — port of pages/CaregiverReportsPage.jsx.
 * GET /reports/adherence, /reports/risk-analysis, /caregiver-dashboard/patients/:id/adherence.
 */
import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';

import { caregiverDashboardApi, reportsApi } from '../../api/services';
import { ExportActions } from '../../components/ExportActions';
import { PatientSelector, useCaregiverPatients } from '../../components/PatientSelector';
import { RiskBadge } from '../../components/RiskBadge';
import { AppText } from '../../components/ui/AppText';
import { Card, SectionHeader, StatTile } from '../../components/ui/Card';
import { AdherenceBarChart, Meter } from '../../components/ui/Charts';
import { Screen, screenStyles } from '../../components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { useTheme } from '../../context/AccessibilityContext';

async function loadReports(patientId: string) {
  const [adherence, risk, bundle] = await Promise.all([
    reportsApi.getAdherence(patientId),
    reportsApi.getRiskAnalysis(patientId),
    caregiverDashboardApi.getPatientAdherence(patientId),
  ]);
  return { adherence, risk, weekly: bundle.weeklyReport };
}

export default function CaregiverReportsScreen() {
  const { colors } = useTheme();
  const { query: overview, patients, selectedId, setSelectedId, selected } = useCaregiverPatients();
  const reports = useQuery({
    queryKey: ['caregiver', 'reports', selectedId],
    queryFn: () => loadReports(selectedId),
    enabled: Boolean(selectedId),
  });

  if (overview.isPending) return <LoadingState label="Loading patients…" />;
  if (overview.isError && !overview.data) return <ErrorState error={overview.error} onRetry={overview.refetch} />;
  if (patients.length === 0) return <EmptyState icon="people-outline" title="No assigned patients found" />;

  const d = reports.data;
  return (
    <Screen onRefresh={() => reports.refetch()}>
      <PatientSelector patients={patients} selectedId={selectedId} onSelect={setSelectedId} renderMeta={(p) => `Risk ${p.riskLevel}`} />
      {selected && (
        <AppText variant="heading">
          Reports for {selected.firstName} {selected.lastName}
        </AppText>
      )}
      <ExportActions patientId={selectedId} />

      {reports.isPending ? (
        <LoadingState label="Loading reports…" />
      ) : reports.isError ? (
        <ErrorState error={reports.error} onRetry={reports.refetch} />
      ) : d ? (
        <>
          <View style={screenStyles.wrap}>
            <StatTile label="Adherence rate" value={`${d.adherence.adherenceRate}%`} icon="checkmark-done-outline" color={colors.primary} />
            <StatTile label="Doses taken" value={d.adherence.takenDoses + d.adherence.delayedDoses} icon="medkit-outline" color={colors.success} />
            <StatTile label="Doses missed" value={d.adherence.missedDoses} icon="close-circle-outline" color={colors.danger} />
            <StatTile label="Risk score" value={d.risk.compositeScore} icon="warning-outline" color={colors.orange} />
          </View>
          <RiskBadge level={d.risk.overallRisk} />

          <SectionHeader title="7-day completion" icon="bar-chart-outline" />
          <Card>
            <AdherenceBarChart data={d.weekly.dailyData} />
          </Card>

          <SectionHeader title="Risk factor breakdown" icon="analytics-outline" />
          <Card>
            <Meter label="Adherence risk" value={d.risk.adherenceRisk} color={colors.primary} />
            <Meter label="Cognitive risk" value={d.risk.cognitiveRisk} color={colors.warning} />
            <Meter label="Behavioral risk" value={d.risk.behavioralRisk} color={colors.purple} />
            {d.risk.factors.length > 0 && (
              <View style={screenStyles.gap}>
                <AppText variant="label" tone="faint">Contributing factors</AppText>
                {d.risk.factors.map((f, i) => (
                  <View key={i}>
                    <AppText weight="700">
                      {f.factor} <AppText variant="caption" tone="faint">(weight {f.weight})</AppText>
                    </AppText>
                    <AppText variant="caption" tone="muted">{f.description}</AppText>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
