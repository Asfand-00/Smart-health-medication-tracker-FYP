/**
 * Compliance logs — port of pages/AdherenceHistoryPage.jsx.
 * Filters (medication, status, date range) + paginated GET /adherence/history.
 * The web table becomes cards; web page buttons become infinite scroll.
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { adherenceApi, medicationApi } from '../../api/services';
import { qk } from '../../api/queryClient';
import { ExportActions } from '../../components/ExportActions';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card, Pill } from '../../components/ui/Card';
import { DateField, SelectField } from '../../components/ui/Form';
import { screenStyles, useRefresh } from '../../components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { useTheme } from '../../context/AccessibilityContext';
import { statusColor } from '../../theme';
import { endOfDay, formatDate, formatTime, fromDateKey, startOfDay } from '../../utils/format';

const PAGE_SIZE = 15;
const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'taken', label: 'Taken' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'missed', label: 'Missed' },
] as const;

export default function AdherenceHistoryScreen() {
  const { colors } = useTheme();
  const [medicationId, setMedicationId] = useState('');
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const meds = useQuery({ queryKey: qk.medications, queryFn: medicationApi.getAll });

  // The backend only applies a date range when both ends are set.
  const filters = useMemo(
    () => ({
      medicationId,
      status,
      startDate: startDate && endDate ? startOfDay(fromDateKey(startDate)).toISOString() : '',
      endDate: startDate && endDate ? endOfDay(fromDateKey(endDate)).toISOString() : '',
    }),
    [medicationId, status, startDate, endDate],
  );

  const logs = useInfiniteQuery({
    queryKey: qk.adherenceHistory(filters),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => adherenceApi.getHistory({ ...filters, page: pageParam, limit: PAGE_SIZE }),
    getNextPageParam: (last, all) => (all.length < last.totalPages ? all.length + 1 : undefined),
  });

  const items = logs.data?.pages.flatMap((p) => p.logs) ?? [];
  const total = logs.data?.pages[0]?.total ?? 0;
  const { refreshing, refresh } = useRefresh(() => logs.refetch());

  const reset = () => {
    setMedicationId('');
    setStatus('');
    setStartDate('');
    setEndDate('');
  };

  const activeFilters = [medicationId, status, startDate && endDate].filter(Boolean).length;

  return (
    <FlatList
      data={items}
      keyExtractor={(l) => l._id}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={screenStyles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (logs.hasNextPage && !logs.isFetchingNextPage) logs.fetchNextPage();
      }}
      ListHeaderComponent={
        <View style={screenStyles.gap}>
          <AppText tone="muted">Search and audit all recorded dose responses.</AppText>
          <ExportActions />
          <Button
            title={showFilters ? 'Hide filters' : `Filters${activeFilters ? ` (${activeFilters})` : ''}`}
            icon="filter-outline"
            variant="secondary"
            onPress={() => setShowFilters((s) => !s)}
          />
          {showFilters && (
            <Card>
              <SelectField
                label="Medication"
                value={medicationId}
                onChange={setMedicationId}
                options={[{ value: '', label: 'All medications' }, ...(meds.data ?? []).map((m) => ({ value: m._id, label: m.medicineName }))]}
              />
              <SelectField label="Status" value={status} onChange={setStatus} options={STATUSES.map((s) => ({ ...s }))} />
              <DateField label="From date" optional value={startDate} onChange={setStartDate} />
              <DateField label="To date" optional value={endDate} onChange={setEndDate} />
              {(startDate && !endDate) || (!startDate && endDate) ? (
                <AppText variant="caption" tone="warning">Set both dates to filter by date range.</AppText>
              ) : null}
              <Button title="Reset filters" variant="ghost" onPress={reset} />
            </Card>
          )}
          {!logs.isPending && !logs.isError && (
            <AppText variant="caption" tone="faint">
              {total} log{total === 1 ? '' : 's'}
            </AppText>
          )}
        </View>
      }
      ListEmptyComponent={
        logs.isPending ? (
          <LoadingState />
        ) : logs.isError ? (
          <ErrorState error={logs.error} onRetry={logs.refetch} />
        ) : (
          <EmptyState icon="search-outline" title="No logs matched your current filters." />
        )
      }
      ListFooterComponent={logs.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null}
      renderItem={({ item }) => (
        <Card>
          <View style={styles.head}>
            <View style={screenStyles.flex}>
              <AppText weight="700">{item.medicationId?.medicineName ?? 'Medication'}</AppText>
              <AppText variant="caption" tone="faint">
                {formatDate(item.date)} · {item.timeOfDay} · {item.medicationId?.dosage ?? '—'}
              </AppText>
            </View>
            <Pill label={item.status} color={statusColor(colors, item.status)} />
          </View>
          <AppText variant="caption" tone="faint">
            Confirmed at: {item.confirmedAt ? formatTime(item.confirmedAt) : '—'}
          </AppText>
          {item.notes ? <AppText variant="caption" tone="muted">📝 {item.notes}</AppText> : null}
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({ head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 } });
