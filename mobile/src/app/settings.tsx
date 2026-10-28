/**
 * Settings — accessibility, security (change password, recovery email,
 * sign out everywhere), notifications, privacy (export / delete) and
 * connection details. Everything here is backed by a real endpoint.
 */
import { useMutation } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { errorMessage } from '../api/client';
import { authApi, userApi } from '../api/services';
import { AccessibilityControls } from '../components/AccessibilityControls';
import { AppText } from '../components/ui/AppText';
import { Button } from '../components/ui/Button';
import { Card, Divider, KeyValue, ListItem, SectionHeader } from '../components/ui/Card';
import { TextField } from '../components/ui/Form';
import { Screen, screenStyles } from '../components/ui/Screen';
import { Sheet } from '../components/ui/Sheet';
import { API_BASE_URL, SERVER_ORIGIN_SOURCE } from '../config/env';
import { useTheme } from '../context/AccessibilityContext';
import { useAuth, useCurrentUser } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { confirmAction } from '../utils/confirm';
import { EMAIL_RE, formatDateTime, toDateKey } from '../utils/format';

export default function SettingsScreen() {
  const { connected } = useSocket();
  const { colors } = useTheme();
  const user = useCurrentUser();
  const { logout, updateUser } = useAuth();
  const toast = useToast();
  const router = useRouter();

  // ── change password ──
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const changePassword = useMutation({
    mutationFn: () => authApi.changePassword(pw.current, pw.next),
    onSuccess: async () => {
      // The backend bumps the token version; the fresh token is in the response
      // but the simplest safe path is to re-authenticate.
      toast.success('Password changed. Please sign in again on this device.');
      setPwOpen(false);
      setPw({ current: '', next: '', confirm: '' });
      await logout('Password changed — please sign in again.');
    },
    onError: (e) => {
      const msg = errorMessage(e);
      if (/current password/i.test(msg)) setPwErrors({ current: msg });
      else toast.error(msg);
    },
  });
  const submitPassword = () => {
    const next: typeof pwErrors = {};
    if (!pw.current) next.current = 'Enter your current password';
    if (pw.next.length < 6) next.next = 'At least 6 characters';
    else if (!/\d/.test(pw.next)) next.next = 'Must contain a number';
    if (pw.next !== pw.confirm) next.confirm = 'Passwords do not match';
    setPwErrors(next);
    if (Object.keys(next).length === 0) changePassword.mutate();
  };

  // ── recovery email ──
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState(user.recoveryEmail ?? '');
  const [recoveryError, setRecoveryError] = useState<string>();
  const saveRecovery = useMutation({
    mutationFn: () => userApi.updateRecovery({ recoveryEmail: recoveryEmail.trim() }),
    onSuccess: async (updated) => {
      await updateUser(updated);
      toast.success('Recovery email saved.');
      setRecoveryOpen(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  // ── sessions ──
  const signOutEverywhere = async () => {
    if (!(await confirmAction('Sign out everywhere', 'Every device signed in to your account will be signed out, including this one.', 'Sign out all', true))) return;
    try {
      await authApi.logout(true);
    } catch {
      // the token may already be revoked — fall through to local sign-out
    }
    await logout('Signed out on all devices.');
  };

  // ── privacy ──
  const [exporting, setExporting] = useState(false);
  const exportData = async () => {
    setExporting(true);
    try {
      const data = await userApi.exportData();
      const json = JSON.stringify(data, null, 2);
      const filename = `my-health-data-${toDateKey(new Date())}.json`;
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const file = new File(Paths.cache, filename);
        if (file.exists) file.delete();
        file.create();
        file.write(json);
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export my data' });
        else toast.info(`Saved to ${file.uri}`);
      }
      toast.success('Your data export is ready.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const deleteAccount = useMutation({
    mutationFn: () => userApi.deleteAccount(deletePassword),
    onSuccess: async () => {
      setDeleteOpen(false);
      await logout('Your account has been deleted.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Screen>
      <SectionHeader title="Accessibility" icon="accessibility-outline" />
      <AccessibilityControls />

      <SectionHeader title="Security" icon="lock-closed-outline" />
      <Card>
        <ListItem title="Change password" subtitle={user.passwordChangedAt ? `Last changed ${formatDateTime(user.passwordChangedAt)}` : 'Signs out your other devices'} icon="key-outline" onPress={() => setPwOpen(true)} />
        <Divider />
        <ListItem title="Recovery email" subtitle={user.recoveryEmail ? user.recoveryEmail : 'Not set — add a backup address for password recovery'} icon="mail-unread-outline" onPress={() => setRecoveryOpen(true)} />
        <Divider />
        <ListItem title="Sign out everywhere" subtitle="Revoke every active session" icon="log-out-outline" destructive onPress={signOutEverywhere} />
        <Divider />
        <ListItem title="Account activity" subtitle="Sign-ins and changes made with your account" icon="list-outline" onPress={() => router.push('/activity')} />
      </Card>

      <SectionHeader title="Notifications" icon="notifications-outline" />
      <Card>
        <ListItem title="Alerts & channels" subtitle="Push, email, SMS, quiet hours, alert types" icon="options-outline" onPress={() => router.push('/notification-settings')} />
      </Card>

      <SectionHeader title="Privacy" icon="shield-checkmark-outline" />
      <Card>
        <AppText variant="caption" tone="faint">
          Your health data is stored encrypted at rest and sent over an encrypted connection. Documents you upload are encrypted on the server.
          {user.privacyConsentAt ? ` Privacy policy accepted ${formatDateTime(user.privacyConsentAt)}.` : ''}
        </AppText>
        <Button title="Export my data (JSON)" icon="download-outline" variant="secondary" onPress={exportData} loading={exporting} />
        {user.role !== 'admin' && <Button title="Delete my account" icon="trash-outline" variant="danger" onPress={() => setDeleteOpen(true)} />}
      </Card>

      <SectionHeader title="Connection" icon="server-outline" />
      <Card>
        <KeyValue label="API server" value={API_BASE_URL} />
        <KeyValue label="Configured from" value={SERVER_ORIGIN_SOURCE} />
        <KeyValue label="Real-time updates" value={connected ? 'Connected' : 'Not connected'} />
        <KeyValue label="Last sign-in" value={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'} />
        <KeyValue label="App version" value={Constants.expoConfig?.version ?? '—'} />
      </Card>

      <Sheet
        visible={pwOpen}
        onClose={() => setPwOpen(false)}
        title="Change password"
        subtitle="Other devices will be signed out"
        footer={
          <>
            <Button title="Cancel" variant="secondary" onPress={() => setPwOpen(false)} style={screenStyles.flex} />
            <Button title="Change password" icon="checkmark" onPress={submitPassword} loading={changePassword.isPending} style={screenStyles.flex} />
          </>
        }
      >
        <TextField label="Current password" value={pw.current} onChangeText={(v) => setPw((p) => ({ ...p, current: v }))} secureTextEntry error={pwErrors.current} autoComplete="current-password" />
        <TextField label="New password" value={pw.next} onChangeText={(v) => setPw((p) => ({ ...p, next: v }))} secureTextEntry error={pwErrors.next} hint="At least 6 characters including a number" autoComplete="new-password" />
        <TextField label="Confirm new password" value={pw.confirm} onChangeText={(v) => setPw((p) => ({ ...p, confirm: v }))} secureTextEntry error={pwErrors.confirm} />
      </Sheet>

      <Sheet
        visible={recoveryOpen}
        onClose={() => setRecoveryOpen(false)}
        title="Recovery email"
        subtitle="Password reset codes are also sent here"
        footer={
          <>
            <Button title="Cancel" variant="secondary" onPress={() => setRecoveryOpen(false)} style={screenStyles.flex} />
            <Button
              title="Save"
              icon="checkmark"
              onPress={() => {
                if (recoveryEmail.trim() && !EMAIL_RE.test(recoveryEmail.trim())) return setRecoveryError('Enter a valid email');
                setRecoveryError(undefined);
                saveRecovery.mutate();
              }}
              loading={saveRecovery.isPending}
              style={screenStyles.flex}
            />
          </>
        }
      >
        <TextField label="Recovery email" icon="mail-outline" value={recoveryEmail} onChangeText={setRecoveryEmail} keyboardType="email-address" autoCapitalize="none" placeholder="backup@example.com" error={recoveryError} hint="Leave empty to remove" />
      </Sheet>

      <Sheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete my account"
        subtitle="This cannot be undone"
        footer={
          <>
            <Button title="Cancel" variant="secondary" onPress={() => setDeleteOpen(false)} style={screenStyles.flex} />
            <Button title="Delete account" icon="trash-outline" variant="danger" onPress={() => deleteAccount.mutate()} disabled={!deletePassword} loading={deleteAccount.isPending} style={screenStyles.flex} />
          </>
        }
      >
        <View style={screenStyles.gap}>
          <AppText tone="muted">
            Your account will be deactivated and your contact details removed. Medical records already shared with your care team are kept for continuity of care.
          </AppText>
          <TextField label="Confirm with your password" value={deletePassword} onChangeText={setDeletePassword} secureTextEntry />
          <AppText variant="caption" color={colors.danger}>
            You will be signed out immediately.
          </AppText>
        </View>
      </Sheet>
    </Screen>
  );
}
