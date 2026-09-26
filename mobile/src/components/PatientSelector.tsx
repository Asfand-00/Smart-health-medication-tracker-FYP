import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { qk } from '../api/queryClient';
import { caregiverDashboardApi } from '../api/services';
import { useTheme } from '../context/AccessibilityContext';
import { radius, spacing } from '../theme';
import type { CaregiverOverviewPatient } from '../types/models';
import { AppText } from './ui/AppText';

/**
 * Caregiver pages (monitoring, notes, cognitive, reports, emergency contacts)
 * all start from GET /caregiver-dashboard/overview and default to the first
 * patient — same as the web pages.
 */
export function useCaregiverPatients(initialId?: string, enabled = true) {
  const query = useQuery({ queryKey: qk.caregiverOverview, queryFn: caregiverDashboardApi.getOverview, enabled });
  const [selectedId, setSelectedId] = useState<string>(initialId ?? '');

  useEffect(() => {
    const list = query.data ?? [];
    if (list.length === 0) return;
    if (!selectedId || !list.some((p) => p.patientId === selectedId)) {
      setSelectedId(list[0].patientId);
    }
  }, [query.data, selectedId]);

  const selected = query.data?.find((p) => p.patientId === selectedId) ?? null;
  return { query, patients: query.data ?? [], selectedId, setSelectedId, selected };
}

export function PatientSelector({
  patients,
  selectedId,
  onSelect,
  renderMeta,
}: {
  patients: CaregiverOverviewPatient[];
  selectedId: string;
  onSelect: (id: string) => void;
  renderMeta?: (p: CaregiverOverviewPatient) => string | null;
}) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <View>
      <AppText variant="label" tone="faint" style={styles.label}>
        Patient
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="radiogroup">
        {patients.map((p) => {
          const active = p.patientId === selectedId;
          const meta = renderMeta?.(p);
          return (
            <Pressable
              key={p.patientId}
              onPress={() => onSelect(p.patientId)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${p.firstName} ${p.lastName}${meta ? `, ${meta}` : ''}`}
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
                {p.firstName} {p.lastName}
              </AppText>
              {meta ? (
                <AppText variant="caption" tone="faint" color={active && theme.highContrast ? '#000' : undefined}>
                  {meta}
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
