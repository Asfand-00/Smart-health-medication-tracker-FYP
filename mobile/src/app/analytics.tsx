/**
 * Health analytics — GET /reports/health-trends, /insights, /performance and
 * CSV / PDF exports. Vitals and adherence as line charts with normal-range
 * bands, data-driven insights, monthly performance over time.
 */
import { useQuery } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { errorMessage } from '../api/client';
import { qk } from '../api/queryClient';
import { reportsApi } from '../api/services';
import { ExportActions } from '../components/ExportActions';
import { PatientPicker, usePatientContext } from '../components/PatientContext';
import { AppText } from '../components/ui/AppText';
import { Button } from '../components/ui/Button';
import { Card, Pill, SectionHeader, StatTile } from '../components/ui/Card';
import { BarChart, LineChart } from '../components/ui/Charts';
import { SegmentedControl } from '../components/ui/Form';
import { Screen, screenStyles } from '../components/ui/Screen';
import { ErrorState, LoadingState } from '../components/ui/States';
import { useTheme } from '../context/AccessibilityContext';
import { useToast } from '../context/ToastContext';
import { statusColor } from '../theme';
import type { CsvExportType, VitalKey } from '../types/models';
import { formatDate, toDateKey } from '../utils/format';

const VITALS: VitalKey[] = ['systolic', 'diastolic', 'heartRate', 'bloodSugar', 'oxygenLevel', 'weight', 'temperature'];
const shortDate = (d: string | Date) => formatDate(d, { day: 'numeric', month: 'short' });

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const ctx = usePatientContext();
  const [days, setDays] = useState<'14' | '30' | '90'>('30');
  const [exporting, setExporting] = useState<CsvExportType | null>(null);

  const trends = useQuery({ queryKey: qk.healthTrends(ctx.patientId, Number(days)), queryFn: () => reportsApi.healthTrends(ctx.patientParam, Number(days)), enabled: Boolean(ctx.patientId) });
  const insights = useQuery({ queryKey: [...qk.analyticsInsights(ctx.patientId), days], queryFn: () => reportsApi.insights(ctx.patientParam, Number(days)), enabled: Boolean(ctx.patientId) });
  const performance = useQuery({ queryKey: qk.performance(ctx.patientId), queryFn: () => reportsApi.performance(ctx.patientParam, 6), enabled: Boolean(ctx.patientId) });

  const exportCsv = async (type: CsvExportType) => {
    setExporting(type);
    try {
      const csv = await reportsApi.exportCsv(type, ctx.patientParam);
      const filename = `${type}-${toDateKey(new Date())}.csv`;
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const file = new File(Paths.cache, filename);
        if (file.exists) file.delete();
        file.create();
        file.write(csv);
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: `Share ${type} export` });
        else toast.info(`Saved to ${file.uri}`);
      }
      toast.success(`${type} CSV ready.`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(null);
    }
  };

  const t = trends.data;
  const arrow = (dir: string) => (dir === 'rising' ? '↑' : dir === 'falling' ? '↓' : dir === 'stable' ? '→' : '·');

  return (
    <Screen onRefresh={() => Promise.all([trends.refetch(), insights.refetch(), performance.refetch()])}>
      <PatientPicker ctx={ctx} />
      {ctx.patientId ? (
        <>
          <SegmentedControl value={days} onChange={setDays} options={[{ value: '14', label: '2 weeks' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />

          <SectionHeader title="Data-driven insights" icon="bulb-outline" />
          {insights.isPending ? (
            <LoadingState />
          ) : insights.isError ? (
            <ErrorState error={insights.error} onRetry={insights.refetch} />
          ) : (
            <Card>
              {insights.data!.insights.map((i, idx) => (
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
          )}

          {trends.isPending ? (
            <LoadingState label="Loading trends…" />
          ) : trends.isError ? (
            <ErrorState error={trends.error} onRetry={trends.refetch} />
          ) : t ? (
            <>
              <SectionHeader title="Adherence over time" icon="trending-up-outline" />
              <Card>
                <AppText variant="caption" tone="muted">
                  Daily percentage of scheduled doses taken · trend {arrow(t.adherence.trend.direction)} {t.adherence.trend.direction} · this week {t.adherence.weeklyPercent}%
                </AppText>
                <LineChart points={t.adherence.series.filter((p) => p.percent != null).map((p) => ({ label: shortDate(p.date + 'T00:00:00'), value: p.percent as number }))} color={colors.primary} unit="%" />
              </Card>

              <SectionHeader title="Health trends" icon="pulse-outline" />
              {VITALS.map((key) => {
                const s = t.vitals[key];
                if (!s || s.stats.count === 0) return null;
                const bad = s.outOfRange > 0;
                return (
                  <Card key={key} accent={bad ? colors.warning : undefined}>
                    <View style={screenStyles.row}>
                      <View style={screenStyles.flex}>
                        <AppText weight="700">
                          {s.label} ({s.unit})
                        </AppText>
                        <AppText variant="caption" tone="faint">
                          latest {s.stats.latest} · avg {s.stats.avg} · min {s.stats.min} · max {s.stats.max} · {s.stats.count} readings
                        </AppText>
                      </View>
                      <Pill label={`${arrow(s.trend.direction)} ${s.trend.direction}`} color={s.trend.direction === 'rising' && ['systolic', 'diastolic', 'bloodSugar', 'heartRate'].includes(key) ? colors.warning : colors.textFaint} />
                    </View>
                    {bad ? (
                      <AppText variant="caption" color={colors.warning}>
                        {s.outOfRange} reading{s.outOfRange === 1 ? '' : 's'} outside the normal range ({s.low}–{s.high} {s.unit}).
                      </AppText>
                    ) : null}
                    <LineChart points={s.points.map((p) => ({ label: shortDate(p.date), value: p.value }))} color={bad ? colors.warning : colors.teal} unit={s.unit} low={s.low} high={s.high} />
                  </Card>
                );
              })}
              {VITALS.every((k) => !t.vitals[k] || t.vitals[k].stats.count === 0) ? (
                <Card>
                  <AppText tone="faint">No vitals recorded in this period. Log vitals from the Vitals tab to see trends.</AppText>
                </Card>
              ) : null}

              {t.mood.series.length > 0 ? (
                <Card>
                  <AppText weight="700">Mood (1 = agitated/confused … 5 = happy)</AppText>
                  <AppText variant="caption" tone="faint">
                    avg {t.mood.stats.avg} · trend {t.mood.trend.direction}
                  </AppText>
                  <LineChart points={t.mood.series.map((m) => ({ label: shortDate(m.date), value: m.score }))} color={colors.pink} low={3} high={5} height={140} />
                </Card>
              ) : null}
              {t.cognitive.series.length > 0 ? (
                <Card>
                  <AppText weight="700">Cognitive assessment score (%)</AppText>
                  <AppText variant="caption" tone="faint">
                    trend {t.cognitive.trend.direction}
                  </AppText>
                  <LineChart points={t.cognitive.series.map((c) => ({ label: shortDate(c.date), value: c.percent }))} color={colors.purple} unit="%" height={140} />
                </Card>
              ) : null}
            </>
          ) : null}

          <SectionHeader title="Performance over time" icon="calendar-outline" />
          {performance.isPending ? (
            <LoadingState />
          ) : performance.isError ? (
            <ErrorState error={performance.error} onRetry={performance.refetch} />
          ) : performance.data ? (
            <Card>
              <BarChart data={performance.data.monthly.map((m) => ({ label: m.month.slice(5), value: m.totalDoses ? m.adherencePercent : null, sub: m.totalDoses ? `${m.takenDoses}/${m.totalDoses}` : undefined }))} color={(v) => (v >= 80 ? colors.success : v >= 50 ? colors.warning : colors.danger)} />
              <View style={screenStyles.wrap}>
                <StatTile label="Best week" value={performance.data.bestWeek ? `${performance.data.bestWeek.adherencePercent}%` : '—'} sub={performance.data.bestWeek ? `${performance.data.bestWeek.month} wk ${performance.data.bestWeek.week}` : ''} icon="trophy-outline" color={colors.success} />
                <StatTile label="Month vs last" value={performance.data.monthOverMonthChange == null ? '—' : `${performance.data.monthOverMonthChange > 0 ? '+' : ''}${performance.data.monthOverMonthChange} pts`} sub={performance.data.trend.direction} icon="swap-vertical-outline" color={colors.primary} />
              </View>
            </Card>
          ) : null}

          <SectionHeader title="Downloadable reports" icon="download-outline" />
          <Card>
            <ExportActions patientId={ctx.patientParam} />
            <View style={screenStyles.wrap}>
              {(['vitals', 'medications', 'mood', 'full'] as CsvExportType[]).map((type) => (
                <Button key={type} title={`${type} CSV`} icon="document-outline" variant="secondary" onPress={() => exportCsv(type)} loading={exporting === type} />
              ))}
            </View>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
