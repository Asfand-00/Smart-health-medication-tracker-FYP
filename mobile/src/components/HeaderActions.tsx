import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { qk } from '../api/queryClient';
import { notificationApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { IconButton } from './ui/Button';

export function useUnreadCount() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: qk.unreadCount,
    queryFn: notificationApi.getUnreadCount,
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });
}

/** Top-right header actions (web: bell with unread badge + avatar in the navbar). */
export function HeaderActions() {
  const router = useRouter();
  const unread = useUnreadCount();
  const count = unread.data ?? 0;
  return (
    <View style={styles.row}>
      <IconButton
        icon="notifications-outline"
        accessibilityLabel={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
        badge={count}
        onPress={() => router.push('/notifications')}
      />
      <IconButton icon="person-circle-outline" accessibilityLabel="My profile" onPress={() => router.push('/profile')} />
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', marginRight: 4 } });
