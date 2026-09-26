/**
 * Health vitals — port of pages/dashboards/VitalsPage.jsx.
 * The web table becomes a list of cards; add via bottom sheet; delete with confirmation.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { errorMessage } from '../../../api/client';
import { qk } from '../../../api/queryClient';
import { vitalsApi } from '../../../api/services';
import { AppText } from '../../../components/ui/AppText';
import { Button, IconButton } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { screenStyles, useRefresh } from '../../../components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import { VitalsFormSheet } from '../../../components/VitalsFormSheet';
import { useTheme } from '../../../context/AccessibilityContext';
import { useToast } from '../../../context/ToastContext';
import type { Vitals } from '../../../types/models';
import { confirmAction } from '../../../utils/confirm';
import { formatDateTime } from '../../../utils/format';

function Reading({ label, value, unit }: { label: string; value: string | number | undefined; unit: string }) {
  return (
    <View style={styles.reading} accessible accessibilityLabel={`${label}: ${value ?? 'not recorded'} ${value != null ? unit : ''}`}>
      <AppText variant="caption" tone="faint">
        {label}
      </AppText>
      <AppText weight="700">
        {value ?? '—'} <AppText variant="caption" tone="faint">{unit}</AppText>
      </AppText>
    </View>
  );
}

export default function VitalsScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const history = useQuery({ queryKey: qk.vitalsHistory, queryFn: vitalsApi.getHistory });

  const add = useMutation({
    mutationFn: vitalsApi.add,
    onSuccess: () => {
      toast.success('Vitals recorded successfully');
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['vitals'] });
    },
    onError: (e) => toast.error(errorMessage(e) || 'Failed to record vitals'),
  });

  const remove = useMutation({
    mutationFn: vitalsApi.remove,
    onSuccess: (_d, id) => {
      toast.success('Record deleted');
      queryClient.setQueryData<Vitals[]>(qk.vitalsHistory, (prev) => prev?.filter((v) => v._id !== id));
      queryClient.invalidateQueries({ queryKey: ['vitals'] });
    },
    onError: () => toast.error('Failed to delete record'),
  });

  const { refreshing, refresh } = useRefresh(() => history.refetch());

  if (history.isPending) return <LoadingState label="Loading vitals…" />;
  if (history.isError && !history.data) return <ErrorState error={history.error} onRetry={history.refetch} />;

  return (
    <>
      <FlatList
        data={history.data}
        keyExtractor={(v) => v._id}
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={screenStyles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={screenStyles.gap}>
            <AppText tone="muted">Track your body's vital signs over time.</AppText>
            <Button title="Record new vitals" icon="add-circle-outline" onPress={() => setOpen(true)} />
          </View>
        }
        ListEmptyComponent={<EmptyState icon="pulse-outline" title="No vitals recorded" message="Start tracking your health today." />}
        renderItem={({ item: v }) => (
          <Card>
            <View style={styles.head}>
              <AppText weight="700" style={screenStyles.flex}>
                {formatDateTime(v.recordedAt)}
              </AppText>
              <IconButton
                icon="trash-outline"
                color={colors.danger}
                accessibilityLabel={`Delete vitals from ${formatDateTime(v.recordedAt)}`}
                onPress={async () => {
                  if (await confirmAction('Delete record', 'Delete this vitals record?')) remove.mutate(v._id);
                }}
              />
            </View>
            <View style={styles.grid}>
              <Reading label="Blood pressure" value={v.bloodPressure?.systolic ? `${v.bloodPressure.systolic}/${v.bloodPressure.diastolic ?? '—'}` : undefined} unit="mmHg" />
              <Reading label="Heart rate" value={v.heartRate} unit="bpm" />
              <Reading label="Blood sugar" value={v.bloodSugar} unit="mg/dL" />
              <Reading label="Weight" value={v.weight} unit="kg" />
              <Reading label="Oxygen" value={v.oxygenLevel} unit="%" />
            </View>
            {v.note ? <AppText variant="caption" tone="muted">📝 {v.note}</AppText> : null}
          </Card>
        )}
      />
      <VitalsFormSheet visible={open} onClose={() => setOpen(false)} onSubmit={(p) => add.mutate(p)} saving={add.isPending} />
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  reading: { width: '50%', gap: 2 },
});
