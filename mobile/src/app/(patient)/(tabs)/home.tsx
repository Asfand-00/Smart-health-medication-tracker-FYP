/**
 * Patient home — port of pages/dashboards/PatientDashboard.jsx.
 *  - greeting + medication count
 *  - adherence rings (today / all-time taken vs missed) from GET /medication/stats
 *  - quick stat tiles (medications, BP, heart rate, oxygen) from GET /vitals
 *  - medications scheduled for a chosen date
 *  - latest vitals
 *  - daily vitals prompt when GET /vitals/today-check says nothing was logged today
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { errorMessage } from '../../../api/client';
import { qk } from '../../../api/queryClient';
import { medicationApi, vitalsApi } from '../../../api/services';
import { DateNavigator } from '../../../components/DateNavigator';
import { AppText } from '../../../components/ui/AppText';
import { Button } from '../../../components/ui/Button';
import { Card, KeyValue, ListItem, Pill, SectionHeader, StatTile } from '../../../components/ui/Card';
import { ProgressRing } from '../../../components/ui/Charts';
import { Screen, screenStyles } from '../../../components/ui/Screen';
import { ErrorState, LoadingState } from '../../../components/ui/States';
import { VitalsFormSheet } from '../../../components/VitalsFormSheet';
import { useTheme } from '../../../context/AccessibilityContext';
import { useCurrentUser } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import type { Vitals } from '../../../types/models';
import { greeting, isMedicationActiveOn } from '../../../utils/format';

function bp(v: Vitals | null | undefined): string {
  return v?.bloodPressure?.systolic ? `${v.bloodPressure.systolic}/${v.bloodPressure.diastolic ?? '—'}` : '—';
}

export default function PatientHome() {
  const user = useCurrentUser();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const meds = useQuery({ queryKey: qk.medications, queryFn: medicationApi.getAll });
  const stats = useQuery({ queryKey: qk.medicationStats, queryFn: medicationApi.getStats });
  const latest = useQuery({ queryKey: qk.vitalsLatest, queryFn: vitalsApi.getLatest });
  const todayCheck = useQuery({ queryKey: qk.vitalsToday, queryFn: vitalsApi.checkToday });

  const [date, setDate] = useState(new Date());
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const prompted = useRef(false);

  // Once per app session, like the web modal shown on dashboard load.
  useEffect(() => {
    if (!prompted.current && todayCheck.data && !todayCheck.data.hasLoggedToday) {
      prompted.current = true;
      setVitalsOpen(true);
    }
  }, [todayCheck.data]);

  const addVitals = useMutation({
    mutationFn: vitalsApi.add,
    onSuccess: () => {
      toast.success('Vitals recorded! Great job! 💪');
      setVitalsOpen(false);
      queryClient.invalidateQueries({ queryKey: ['vitals'] });
    },
    onError: (e) => toast.error(errorMessage(e) || 'Failed to save vitals'),
  });

  const scheduled = useMemo(() => (meds.data ?? []).filter((m) => isMedicationActiveOn(m, date)), [meds.data, date]);

  const refresh = () => Promise.all([meds.refetch(), stats.refetch(), latest.refetch(), todayCheck.refetch()]);

  const todayPct = stats.data?.today.takenPercent ?? 0;
  const overallPct = stats.data?.overall.takenPercent ?? 0;
  const hasTodayLogs = (stats.data?.today.total ?? 0) > 0;
  const hasOverallLogs = (stats.data?.overall.total ?? 0) > 0;
  const v = latest.data;

  return (
    <Screen onRefresh={refresh}>
      <Card>
        <AppText variant="title" accessibilityRole="header">
          Good {greeting()}, {user.firstName}! 👋
        </AppText>
        <AppText tone="muted">
          You have {meds.isPending ? '…' : meds.data?.length ?? 0} medication{meds.data?.length === 1 ? '' : 's'} registered. Stay on track today!
        </AppText>
        <Button title="Open today's reminders" icon="alarm-outline" onPress={() => router.navigate('/today')} />
      </Card>

      <SectionHeader title="Medication Adherence" icon="trending-up-outline" />
      <Card>
        {stats.isPending ? (
          <LoadingState />
        ) : stats.isError ? (
          <ErrorState error={stats.error} onRetry={stats.refetch} />
        ) : (
          <View style={styles.rings}>
            {/* Missed % is only meaningful once something is logged (the web shows 100% missed on an empty day). */}
            <ProgressRing percent={todayPct} color={colors.teal} label="Today taken" sub={`${stats.data?.today.taken ?? 0} doses`} />
            <ProgressRing percent={hasTodayLogs ? 100 - todayPct : 0} color={colors.danger} label="Today missed" sub={`${stats.data?.today.missed ?? 0} doses`} />
            <ProgressRing percent={overallPct} color={colors.primary} label="All-time taken" sub={`${stats.data?.overall.taken ?? 0} total`} />
            <ProgressRing percent={hasOverallLogs ? 100 - overallPct : 0} color={colors.orange} label="All-time missed" sub={`${stats.data?.overall.missed ?? 0} total`} />
          </View>
        )}
      </Card>

      <View style={screenStyles.wrap}>
        <StatTile label="Medications" value={meds.data?.length ?? '—'} sub="Active" icon="medkit-outline" color={colors.primary} />
        <StatTile label="Blood pressure" value={bp(v)} sub="mmHg" icon="pulse-outline" color={colors.teal} />
        <StatTile label="Heart rate" value={v?.heartRate ?? '—'} sub="bpm" icon="heart-outline" color={colors.purple} />
        <StatTile label="Oxygen" value={v?.oxygenLevel ? `${v.oxygenLevel}%` : '—'} sub="SpO2" icon="water-outline" color={colors.pink} />
      </View>

      <SectionHeader
        title="Your Medications"
        icon="time-outline"
        action={<Button title="Manage" variant="ghost" onPress={() => router.navigate('/medications')} />}
      />
      <DateNavigator date={date} onChange={setDate} />
      <Card>
        {meds.isPending ? (
          <LoadingState />
        ) : meds.isError ? (
          <ErrorState error={meds.error} onRetry={meds.refetch} />
        ) : scheduled.length === 0 ? (
          <View style={screenStyles.gap}>
            <AppText tone="faint">No medications scheduled for this date.</AppText>
            <Button title="+ Manage schedule" variant="secondary" onPress={() => router.navigate('/medications')} />
          </View>
        ) : (
          scheduled.map((m) => (
            <View key={m._id} style={styles.medRow}>
              <View style={screenStyles.flex}>
                <AppText weight="700">{m.medicineName}</AppText>
                <AppText variant="caption" tone="faint">
                  {m.timeOfDay.join(', ')}
                </AppText>
              </View>
              <View style={styles.medRight}>
                <AppText variant="caption" weight="600">
                  {m.dosage}
                </AppText>
                <Pill label={m.frequency} color={colors.primary} />
              </View>
            </View>
          ))
        )}
      </Card>

      <SectionHeader
        title="Latest Vitals"
        icon="pulse-outline"
        action={<Button title="View all" variant="ghost" onPress={() => router.navigate('/vitals')} />}
      />
      <Card>
        {latest.isPending ? (
          <LoadingState />
        ) : !v ? (
          <View style={screenStyles.gap}>
            <AppText tone="faint">No vitals recorded yet.</AppText>
            <Button title="+ Log today's vitals" variant="secondary" onPress={() => setVitalsOpen(true)} />
          </View>
        ) : (
          <>
            <KeyValue label="Blood pressure" value={`${bp(v)} mmHg`} />
            <KeyValue label="Heart rate" value={v.heartRate ? `${v.heartRate} bpm` : '—'} />
            <KeyValue label="Blood sugar" value={v.bloodSugar ? `${v.bloodSugar} mg/dL` : '—'} />
            <KeyValue label="Oxygen level" value={v.oxygenLevel ? `${v.oxygenLevel}% SpO2` : '—'} />
            {!todayCheck.data?.hasLoggedToday && (
              <Button title="Log today's vitals" icon="add" variant="secondary" onPress={() => setVitalsOpen(true)} />
            )}
          </>
        )}
      </Card>

      <SectionHeader title="Quick access" icon="apps-outline" />
      <Card>
        <ListItem title="Mood check" subtitle="How are you feeling today?" icon="happy-outline" onPress={() => router.push('/mood')} />
        <ListItem title="My adherence" subtitle="Compliance rates and history" icon="bar-chart-outline" onPress={() => router.push('/adherence')} />
        <ListItem title="Emergency support" subtitle="Call your trusted contacts" icon="shield-checkmark-outline" onPress={() => router.push('/emergency-contacts')} />
      </Card>

      <VitalsFormSheet
        daily
        visible={vitalsOpen}
        onClose={() => setVitalsOpen(false)}
        onSubmit={(p) => addVitals.mutate(p)}
        saving={addVitals.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  rings: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', rowGap: 16 },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  medRight: { alignItems: 'flex-end', gap: 4 },
});
