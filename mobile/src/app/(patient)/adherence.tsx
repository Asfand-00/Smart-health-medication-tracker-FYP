/**
 * Adherence analytics — port of pages/AdherenceDashboardPage.jsx.
 * GET /adherence/today + /adherence/weekly, 7-day chart, CSV/PDF export.
 */
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { adherenceApi } from '../../api/services';
import { qk } from '../../api/queryClient';
import { AccessibilityControls } from '../../components/AccessibilityControls';
import { ExportActions } from '../../components/ExportActions';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card, SectionHeader, StatTile } from '../../components/ui/Card';
import { AdherenceBarChart } from '../../components/ui/Charts';
import { Screen, screenStyles } from '../../components/ui/Screen';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { useTheme } from '../../context/AccessibilityContext';

export default function AdherenceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const today = useQuery({ queryKey: qk.adherenceToday(), queryFn: () => adherenceApi.getToday() });
  const weekly = useQuery({ queryKey: qk.adherenceWeekly(), queryFn: () => adherenceApi.getWeekly() });

  const refresh = () => Promise.all([today.refetch(), weekly.refetch()]);
  const weeklyPct = weekly.data?.summary.weeklyAdherencePercent ?? 0;

  return (
    <Screen onRefresh={refresh}>
      <AccessibilityControls />
      <AppText tone="muted">Check your medication compliance rates and export reports for your physician.</AppText>
      <ExportActions />

      {today.isPending || weekly.isPending ? (
        <LoadingState />
      ) : today.isError || weekly.isError ? (
        <ErrorState error={today.error ?? weekly.error} onRetry={refresh} />
      ) : (
        <>
          <View style={screenStyles.wrap}>
            <StatTile
              label="Today's rate"
              value={`${today.data?.adherencePercent ?? 0}%`}
              sub={`${(today.data?.taken ?? 0) + (today.data?.delayed ?? 0)} of ${today.data?.total ?? 0} doses taken`}
              icon="today-outline"
              color={colors.primary}
            />
            <StatTile label="Weekly rate" value={`${weeklyPct}%`} sub="Last 7 days" icon="calendar-outline" color={colors.teal} />
          </View>

          <SectionHeader title="7-day completion" icon="bar-chart-outline" />
          <Card>
            <AdherenceBarChart data={weekly.data?.dailyData ?? []} />
          </Card>

          <SectionHeader title="Compliance insights" icon="trending-up-outline" />
          <Card>
            <AppText tone="muted">
              <AppText weight="700">Why it matters: </AppText>
              Consistent medication intake is critical for maintaining cognitive stability in Alzheimer's treatment.
            </AppText>
            <AppText tone="muted">
              Your current 7-day adherence is <AppText weight="700">{weeklyPct}%</AppText>.
              {weeklyPct >= 80
                ? ' Excellent job! Keep maintaining this routine.'
                : ' Try setting voice prompts or asking your caregiver for scheduling help to close the gap.'}
            </AppText>
          </Card>
        </>
      )}

      <Button title="View full log history" icon="list-outline" variant="secondary" onPress={() => router.push('/adherence-history')} />
    </Screen>
  );
}
