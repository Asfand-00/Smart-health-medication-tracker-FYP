/**
 * Access logs & audit trail — GET /audit with category / status / search
 * filters, plus GET /audit/stats counters.
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import { qk } from '../../api/queryClient';
import { auditApi } from '../../api/services';
import { AppText } from '../../components/ui/AppText';
import { Card, Pill, StatTile } from '../../components/ui/Card';
import { SelectField, TextField } from '../../components/ui/Form';
import { screenStyles, useRefresh } from '../../components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { useTheme } from '../../context/AccessibilityContext';
import { formatDateTime, fullName, humanise } from '../../utils/format';

const CATEGORIES = ['', 'auth', 'security', 'user', 'patient', 'medication', 'prescription', 'adherence', 'notification', 'admin', 'data', 'system', 'request'].map((c) => ({ value: c, label: c ? humanise(c) : 'All categories' }));
const STATUSES = [
  { value: '', label: 'All outcomes' },
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
  { value: 'denied', label: 'Denied' },
];

export default function AdminAudit() {
  const { colors } = useTheme();
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const filters = { category, status, search };
  const stats = useQuery({ queryKey: qk.adminAuditStats, queryFn: () => auditApi.stats(7) });
  const list = useInfiniteQuery({
    queryKey: qk.adminAudit(filters),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => auditApi.list({ ...filters, page: pageParam, limit: 40 }),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
  const items = list.data?.pages.flatMap((p) => p.logs) ?? [];
  const { refreshing, refresh } = useRefresh(() => Promise.all([list.refetch(), stats.refetch()]));

  return (
    <FlatList
      data={items}
      keyExtractor={(l) => l._id}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={screenStyles.listContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
      }}
      ListHeaderComponent={
        <View style={screenStyles.gap}>
          {stats.data ? (
            <View style={screenStyles.wrap}>
              <StatTile label="Events (7d)" value={stats.data.total} icon="list-outline" color={colors.primary} />
              <StatTile label="Failed logins" value={stats.data.failedLogins} icon="lock-closed-outline" color={colors.danger} />
              <StatTile label="Denied" value={stats.data.byStatus.denied ?? 0} icon="ban-outline" color={colors.warning} />
              <StatTile label="Failures" value={stats.data.byStatus.failure ?? 0} icon="alert-circle-outline" color={colors.orange} />
            </View>
          ) : null}
          <TextField icon="search-outline" placeholder="Search action, path or details…" value={search} onChangeText={setSearch} autoCapitalize="none" accessibilityLabel="Search audit log" />
          <View style={screenStyles.row}>
            <View style={screenStyles.flex}>
              <SelectField label="Category" value={category} options={CATEGORIES} onChange={setCategory} />
            </View>
            <View style={screenStyles.flex}>
              <SelectField label="Outcome" value={status} options={STATUSES} onChange={setStatus} />
            </View>
          </View>
          <AppText variant="caption" tone="faint">
            {list.data?.pages[0]?.total ?? 0} entries
          </AppText>
        </View>
      }
      ListEmptyComponent={list.isPending ? <LoadingState /> : list.isError ? <ErrorState error={list.error} onRetry={list.refetch} /> : <EmptyState icon="list-outline" title="No audit entries match" />}
      ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null}
      renderItem={({ item }) => {
        const color = item.status === 'success' ? colors.success : item.status === 'denied' ? colors.warning : colors.danger;
        return (
          <Card accent={item.status !== 'success' ? color : undefined} style={{ gap: 4 }}>
            <View style={screenStyles.row}>
              <View style={screenStyles.flex}>
                <AppText weight="700">{item.action}</AppText>
                <AppText variant="caption" tone="faint">
                  {item.userId ? `${fullName(item.userId)} (${item.userRole})` : 'anonymous'} · {formatDateTime(item.createdAt)}
                </AppText>
              </View>
              <Pill label={item.status} color={color} />
            </View>
            <AppText variant="caption" tone="muted">
              {item.method ? `${item.method} ${item.path} → ${item.statusCode ?? ''}` : humanise(item.category)}
              {item.ip ? ` · ${item.ip}` : ''}
            </AppText>
            {item.details ? (
              <AppText variant="caption" tone="faint">
                {item.details}
              </AppText>
            ) : null}
            {item.targetUserId ? (
              <AppText variant="caption" tone="faint">
                Target: {fullName(item.targetUserId)}
              </AppText>
            ) : null}
          </Card>
        );
      }}
    />
  );
}
