/**
 * "Which patient is this screen about?" for the screens shared by several
 * roles (prescriptions, AI insights, analytics, calendar, plan requests…).
 *
 *  - patient   → themselves (no picker shown)
 *  - caregiver → GET /caregiver-dashboard/overview, first patient by default
 *  - doctor    → GET /doctor/patients, first patient by default
 *  - admin     → must arrive with ?patientId= (from the admin user screen)
 *
 * A `patientId` route param pre-selects a patient when navigating from a
 * detail screen.
 */
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { qk } from '../api/queryClient';
import { caregiverDashboardApi, doctorApi } from '../api/services';
import { useTheme } from '../context/AccessibilityContext';
import { useCurrentUser } from '../context/AuthContext';
import { radius, spacing } from '../theme';
import { AppText } from './ui/AppText';
import { EmptyState, ErrorState, LoadingState } from './ui/States';

export interface PatientOption {
  id: string;
  name: string;
  meta?: string;
}

export function usePatientContext() {
  const user = useCurrentUser();
  const params = useLocalSearchParams<{ patientId?: string; name?: string }>();
  const role = user.role;
  const isSelf = role === 'patient';

  const caregiver = useQuery({ queryKey: qk.caregiverOverview, queryFn: caregiverDashboardApi.getOverview, enabled: role === 'caregiver' });
  const doctor = useQuery({ queryKey: qk.doctorPatients, queryFn: doctorApi.patients, enabled: role === 'doctor' });

  const options = useMemo<PatientOption[]>(() => {
    if (role === 'caregiver') {
      return (caregiver.data ?? []).map((p) => ({ id: p.patientId, name: `${p.firstName} ${p.lastName}`, meta: `Adherence ${p.todayAdherence}% · ${p.riskLevel} risk` }));
    }
    if (role === 'doctor') {
      return (doctor.data ?? []).map((p) => ({ id: p.patientId, name: `${p.firstName} ${p.lastName}`, meta: `Week ${p.weeklyAdherence}% · ${p.riskLevel} risk` }));
    }
    if (role === 'admin' && params.patientId) {
      return [{ id: params.patientId, name: params.name ?? 'Selected patient' }];
    }
    return [];
  }, [role, caregiver.data, doctor.data, params.patientId, params.name]);

  const [selectedId, setSelectedId] = useState<string>(params.patientId ?? '');
  useEffect(() => {
    if (isSelf) return;
    if (options.length === 0) return;
    if (!selectedId || !options.some((o) => o.id === selectedId)) setSelectedId(options[0].id);
  }, [options, selectedId, isSelf]);

  const query = role === 'caregiver' ? caregiver : doctor;
  const patientId = isSelf ? user._id || user.id : selectedId;
  const selected = options.find((o) => o.id === patientId) ?? null;

  return {
    role,
    isSelf,
    patientId,
    /** undefined for the patient role, so API calls hit the "my own data" path */
    patientParam: isSelf ? undefined : patientId,
    options,
    selected,
    setPatientId: setSelectedId,
    isLoading: !isSelf && role !== 'admin' && query.isPending,
    isError: !isSelf && role !== 'admin' && query.isError && !query.data,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Horizontal chip picker (hidden for patients). */
export function PatientPicker({ ctx }: { ctx: ReturnType<typeof usePatientContext> }) {
  const theme = useTheme();
  const { colors } = theme;
  if (ctx.isSelf) return null;
  if (ctx.isLoading) return <LoadingState label="Loading patients…" />;
  if (ctx.isError) return <ErrorState error={ctx.error} onRetry={() => ctx.refetch()} />;
  if (ctx.options.length === 0) {
    return (
      <EmptyState
        icon="people-outline"
        title="No patients linked"
        message={ctx.role === 'doctor' ? 'Accept a patient request from the Dashboard tab first.' : 'Accept a care request from the Overview tab first.'}
      />
    );
  }
  return (
    <View>
      <AppText variant="label" tone="faint" style={styles.label}>
        Patient
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="radiogroup">
        {ctx.options.map((p) => {
          const active = p.id === ctx.patientId;
          return (
            <Pressable
              key={p.id}
              onPress={() => ctx.setPatientId(p.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${p.name}${p.meta ? `, ${p.meta}` : ''}`}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? (theme.highContrast ? '#fff' : 'rgba(168,85,247,0.22)') : colors.surface,
                  borderColor: active ? (theme.highContrast ? '#ffff00' : colors.purple) : colors.border,
                  borderWidth: active || theme.highContrast ? 2 : 1,
                },
              ]}
            >
              <AppText weight="700" color={active && theme.highContrast ? '#000' : undefined}>
                {p.name}
              </AppText>
              {p.meta ? (
                <AppText variant="caption" tone="faint" color={active && theme.highContrast ? '#000' : undefined}>
                  {p.meta}
                </AppText>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  row: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: { borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, minHeight: 48, justifyContent: 'center' },
});
