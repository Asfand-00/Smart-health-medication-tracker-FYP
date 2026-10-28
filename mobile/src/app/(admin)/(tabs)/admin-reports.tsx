/**
 * Administrative reporting — GET /admin/reports/overview (user growth,
 * platform adherence by month, notification volume, risk distribution,
 * prescriptions by status, top medications) and CSV exports.
 */
import { useQuery } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { errorMessage } from '../../../api/client';
import { qk } from '../../../api/queryClient';
import { adminApi } from '../../../api/services';
import { AppText } from '../../../components/ui/AppText';
import { Button } from '../../../components/ui/Button';
import { Card, KeyValue, SectionHeader, StatTile } from '../../../components/ui/Card';
import { BarChart } from '../../../components/ui/Charts';
import { Screen, screenStyles } from '../../../components/ui/Screen';
import { ErrorState, LoadingState } from '../../../components/ui/States';
import { useTheme } from '../../../context/AccessibilityContext';
import { useToast } from '../../../context/ToastContext';
import { toDateKey } from '../../../utils/format';

type ExportType = 'users' | 'adherence' | 'audit';

export default function AdminReports() {
  const toast = useToast();
  const { colors } = useTheme();
  const report = useQuery({ queryKey: qk.adminReports, queryFn: () => adminApi.reportsOverview(6) });
  const [exporting, setExporting] = useState<ExportType | null>(null);

  const exportCsv = async (type: ExportType) => {
    setExporting(type);
    try {
      const csv = await adminApi.exportCsv(type);
      const filename = `${type}-report-${toDateKey(new Date())}.csv`;
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
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'text/csv' });
        else toast.info(`Saved to ${file.uri}`);
      }
      toast.success(`${type} report exported.`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(null);
    }
  };

  const d = report.data;
  return (
    <Screen onRefresh={() => report.refetch()}>
      {report.isPending ? (
        <LoadingState />
      ) : report.isError ? (
        <ErrorState error={report.error} onRetry={report.refetch} />
      ) : d ? (
        <>
          <View style={screenStyles.wrap}>
            <StatTile label="Platform adherence" value={`${d.platformAdherencePercent}%`} sub={`${d.totalDosesLogged} doses logged`} icon="trending-up-outline" color={colors.primary} />
            <StatTile label="Patients" value={d.usersByRole.patient ?? 0} sub={`${d.usersByRole.caregiver ?? 0} caregivers · ${d.usersByRole.doctor ?? 0} doctors`} icon="people-outline" color={colors.teal} />
            <StatTile label="High / critical risk" value={(d.riskDistribution.high ?? 0) + (d.riskDistribution.critical ?? 0)} sub={`${d.riskDistribution.low ?? 0} low · ${d.riskDistribution.moderate ?? 0} moderate`} icon="warning-outline" color={colors.danger} />
            <StatTile label="Prescriptions" value={Object.values(d.prescriptionsByStatus).reduce((s, n) => s + n, 0)} sub={`${d.prescriptionsByStatus.pending ?? 0} pending · ${d.prescriptionsByStatus.verified ?? 0} verified`} icon="document-attach-outline" color={colors.warning} />
          </View>

          <SectionHeader title="Adherence by month" icon="bar-chart-outline" />
          <Card>
            <BarChart data={d.adherenceByMonth.map((m) => ({ label: m.month.slice(5), value: m.total ? m.percent : null, sub: `${m.taken}/${m.total}` }))} color={(v) => (v >= 80 ? colors.success : v >= 50 ? colors.warning : colors.danger)} />
          </Card>

          <SectionHeader title="User growth (new accounts per month)" icon="person-add-outline" />
          <Card>
            <BarChart data={d.userGrowth.map((g) => ({ label: g.month.slice(5), value: g.total, sub: `${g.patient ?? 0}p ${g.caregiver ?? 0}c ${g.doctor ?? 0}d` }))} color={colors.primary} max={Math.max(5, ...d.userGrowth.map((g) => g.total))} suffix="" />
          </Card>

          <SectionHeader title="Notifications sent per month" icon="notifications-outline" />
          <Card>
            <BarChart data={d.notificationsByMonth.map((n) => ({ label: n.month.slice(5), value: n.count }))} color={colors.purple} max={Math.max(10, ...d.notificationsByMonth.map((n) => n.count))} suffix="" />
          </Card>

          <SectionHeader title="Most prescribed medicines" icon="medkit-outline" />
          <Card>
            {d.topMedications.length === 0 ? <AppText tone="faint">No medications yet.</AppText> : d.topMedications.map((m) => <KeyValue key={m.name} label={m.name} value={`${m.count} patient${m.count === 1 ? '' : 's'}`} />)}
          </Card>

          <SectionHeader title="Export (CSV)" icon="download-outline" />
          <Card>
            <View style={screenStyles.wrap}>
              {(['users', 'adherence', 'audit'] as ExportType[]).map((t) => (
                <Button key={t} title={`${t} report`} icon="document-outline" variant="secondary" onPress={() => exportCsv(t)} loading={exporting === t} />
              ))}
            </View>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
