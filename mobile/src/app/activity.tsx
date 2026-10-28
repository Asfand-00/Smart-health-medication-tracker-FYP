/**
 * My account activity — GET /audit/me. Sign-ins, password events, exports,
 * data changes made with this account (the user's slice of the audit trail).
 */
import { useInfiniteQuery } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import { qk } from '../api/queryClient';
import { auditApi } from '../api/services';
import { AppText } from '../components/ui/AppText';
import { Card, Pill } from '../components/ui/Card';
import { screenStyles, useRefresh } from '../components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { useTheme } from '../context/AccessibilityContext';
import { formatDateTime, humanise } from '../utils/format';

export default function ActivityScreen() {
  const { colors } = useTheme();
  const list = useInfiniteQuery({
    queryKey: qk.auditMe,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => auditApi.mine({ page: pageParam, limit: 30 }),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
  const items = list.data?.pages.flatMap((p) => p.logs) ?? [];
  const { refreshing, refresh } = useRefresh(() => list.refetch());

  return (
    <FlatList
      data={items}
      keyExtractor={(l) => l._id}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={screenStyles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
      }}
      ListHeaderComponent={<AppText tone="muted">Every sign-in and change made with your account, newest first. If you see something you do not recognise, change your password and sign out everywhere.</AppText>}
      ListEmptyComponent={list.isPending ? <LoadingState /> : list.isError ? <ErrorState error={list.error} onRetry={list.refetch} /> : <EmptyState icon="list-outline" title="No activity recorded yet" />}
      ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null}
      renderItem={({ item }) => {
        const color = item.status === 'success' ? colors.success : item.status === 'denied' ? colors.warning : colors.danger;
        return (
          <Card accent={item.status !== 'success' ? color : undefined}>
            <View style={screenStyles.row}>
              <View style={screenStyles.flex}>
                <AppText weight="700">{humanise(item.action.replace(/\./g, ' · ').replace(/^(get|post|put|patch|delete) /, ''))}</AppText>
                <AppText variant="caption" tone="faint">
                  {formatDateTime(item.createdAt)}
                  {item.ip ? ` · ${item.ip}` : ''}
                </AppText>
              </View>
              <Pill label={item.status} color={color} />
            </View>
            {item.details ? (
              <AppText variant="caption" tone="muted">
                {item.details}
              </AppText>
            ) : null}
          </Card>
        );
      }}
    />
  );
}
