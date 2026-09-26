import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { toApiError } from '../../api/client';
import { useTheme } from '../../context/AccessibilityContext';
import { spacing } from '../../theme';
import { AppText } from './AppText';
import { Button } from './Button';

type IconName = keyof typeof Ionicons.glyphMap;

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const { colors, highContrast } = useTheme();
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={highContrast ? '#fff' : colors.primary} />
      <AppText tone="faint">{label}</AppText>
    </View>
  );
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  message,
  action,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={44} color={colors.textFaint} />
      <AppText variant="heading" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText tone="faint" align="center">
          {message}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}

const ERROR_ICON: Record<string, IconName> = {
  network: 'cloud-offline-outline',
  timeout: 'time-outline',
  forbidden: 'lock-closed-outline',
  unauthorized: 'log-in-outline',
  not_found: 'search-outline',
  server: 'server-outline',
};

const ERROR_TITLE: Record<string, string> = {
  network: "You're offline or the server is unreachable",
  timeout: 'The request timed out',
  forbidden: 'Access denied',
  unauthorized: 'Session expired',
  not_found: 'Not found',
  server: 'Server error',
  validation: 'Request rejected',
};

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { colors } = useTheme();
  const apiError = toApiError(error);
  return (
    <View style={styles.center} accessibilityRole="alert">
      <Ionicons name={ERROR_ICON[apiError.kind] ?? 'alert-circle-outline'} size={44} color={colors.danger} />
      <AppText variant="heading" align="center">
        {ERROR_TITLE[apiError.kind] ?? 'Something went wrong'}
      </AppText>
      <AppText tone="faint" align="center">
        {apiError.message}
      </AppText>
      {onRetry && apiError.kind !== 'forbidden' ? <Button title="Try again" icon="refresh" onPress={onRetry} /> : null}
    </View>
  );
}

/**
 * Renders loading / error / empty / content for a TanStack query so no screen
 * is ever blank.
 */
export function QueryState<T>({
  query,
  loadingLabel,
  isEmpty,
  empty,
  children,
}: {
  query: { data: T | undefined; isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
  loadingLabel?: string;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <LoadingState label={loadingLabel} />;
  if (query.isError && query.data === undefined) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.data === undefined) return null;
  if (isEmpty && isEmpty(query.data) && empty) return <>{empty}</>;
  return <>{children(query.data)}</>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
});
