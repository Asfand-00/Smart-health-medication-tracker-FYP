/**
 * Settings.
 *
 * The web SettingsPage.jsx has "Change password" and "Account recovery" forms,
 * but both only wait on a setTimeout and show a success toast — the backend
 * has no endpoint for either. Reproducing that would tell users their password
 * changed when it did not, so this screen states plainly that these are not
 * available yet. Everything shown here actually works.
 */
import Constants from 'expo-constants';

import { AccessibilityControls } from '../components/AccessibilityControls';
import { AppText } from '../components/ui/AppText';
import { Card, KeyValue, SectionHeader } from '../components/ui/Card';
import { Screen } from '../components/ui/Screen';
import { API_BASE_URL, SERVER_ORIGIN_SOURCE } from '../config/env';
import { useSocket } from '../context/SocketContext';

export default function SettingsScreen() {
  const { connected } = useSocket();
  return (
    <Screen>
      <SectionHeader title="Accessibility" icon="accessibility-outline" />
      <AccessibilityControls />

      <SectionHeader title="Security" icon="lock-closed-outline" />
      <Card>
        <AppText weight="700">Change password & account recovery</AppText>
        <AppText variant="caption" tone="muted">
          Not available yet: the server does not provide password-change or recovery-email endpoints. The web app's forms for these
          do not save anything. Contact an administrator if you need your password reset.
        </AppText>
      </Card>

      <SectionHeader title="Connection" icon="server-outline" />
      <Card>
        <KeyValue label="API server" value={API_BASE_URL} />
        <KeyValue label="Configured from" value={SERVER_ORIGIN_SOURCE} />
        <KeyValue label="Real-time updates" value={connected ? 'Connected' : 'Not connected'} />
        <KeyValue label="App version" value={Constants.expoConfig?.version ?? '—'} />
      </Card>
    </Screen>
  );
}
