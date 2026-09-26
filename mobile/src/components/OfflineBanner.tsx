import { Ionicons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './ui/AppText';

/**
 * Global "no internet" banner. Queries are paused by TanStack's onlineManager
 * while offline and refetch automatically when the connection returns.
 */
export function OfflineBanner() {
  const netInfo = useNetInfo();
  const insets = useSafeAreaInsets();
  // isConnected is null while unknown — only warn on a definite "false".
  if (netInfo.isConnected !== false) return null;
  return (
    <View style={[styles.banner, { paddingTop: insets.top + 4 }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline" size={16} color="#1c1917" />
      <AppText variant="caption" weight="700" color="#1c1917">
        No internet connection — showing saved data. Changes need a connection.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#fbbf24',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
});
