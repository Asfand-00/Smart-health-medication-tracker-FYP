import { StyleSheet, View } from 'react-native';

import { useTheme } from '../context/AccessibilityContext';
import type { NotificationDelivery } from '../types/models';
import { AppText } from './ui/AppText';
import { Pill } from './ui/Card';

const CHANNEL_LABEL: Record<NotificationDelivery['channel'], string> = {
  in_app: 'In-app',
  email: 'Email',
  push: 'Push',
  sms: 'SMS',
  voice: 'Voice',
};

/** Shows what happened on each delivery channel of a notification. */
export function DeliveryPills({ deliveries, verbose = false }: { deliveries: NotificationDelivery[]; verbose?: boolean }) {
  const { colors } = useTheme();
  if (!deliveries.length) return null;
  const color = (s: NotificationDelivery['status']) => (s === 'sent' ? colors.success : s === 'mock' ? colors.teal : s === 'failed' ? colors.danger : colors.textFaint);
  return (
    <View style={styles.wrap}>
      {deliveries.map((d, i) => (
        <View key={`${d.channel}-${i}`} style={verbose ? styles.verboseRow : undefined}>
          <Pill label={`${CHANNEL_LABEL[d.channel]}: ${d.status === 'mock' ? 'sent (mock)' : d.status}`} color={color(d.status)} />
          {verbose && d.detail ? (
            <AppText variant="caption" tone="faint">
              {d.detail}
            </AppText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  verboseRow: { gap: 2, width: '100%' },
});
