/**
 * Notification settings — GET/PUT /notifications/settings.
 * Channels (in-app, email, push, SMS), alert types, quiet hours, SMS number,
 * registered devices and a "send me a test" button that shows exactly what
 * each channel did (delivery log).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { errorMessage } from '../api/client';
import { qk } from '../api/queryClient';
import { notificationApi } from '../api/services';
import { DeliveryPills } from '../components/DeliveryPills';
import { AppText } from '../components/ui/AppText';
import { Button } from '../components/ui/Button';
import { Card, SectionHeader } from '../components/ui/Card';
import { TextField, ToggleRow } from '../components/ui/Form';
import { Screen, screenStyles } from '../components/ui/Screen';
import { ErrorState, LoadingState } from '../components/ui/States';
import { useTheme } from '../context/AccessibilityContext';
import { useToast } from '../context/ToastContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import type { AppNotification, NotificationSettings, NotificationSettingsPayload, NotificationType } from '../types/models';
import { formatDateTime, humanise } from '../utils/format';

const TYPE_LABELS: { type: NotificationType; label: string; hint: string }[] = [
  { type: 'reminder', label: 'Medication reminders', hint: 'Scheduled dose alerts' },
  { type: 'missed_dose', label: 'Missed doses', hint: 'When a dose is missed or skipped' },
  { type: 'escalation', label: 'Escalations', hint: 'Overdue doses after repeated reminders' },
  { type: 'ai_alert', label: 'AI predictions', hint: 'Doses predicted to be missed, risk warnings' },
  { type: 'prescription', label: 'Prescriptions', hint: 'Uploads, verification results' },
  { type: 'plan_request', label: 'Plan approvals', hint: 'Medication change requests and decisions' },
  { type: 'medication_update', label: 'Medication changes', hint: 'Added or edited medicines' },
  { type: 'adherence_update', label: 'Adherence updates', hint: 'Doses confirmed by the care team' },
  { type: 'doctor_note', label: 'Doctor notes', hint: 'New clinical notes and follow-ups' },
  { type: 'mood_update', label: 'Mood updates', hint: 'Mood check-ins' },
  { type: 'cognitive_alert', label: 'Cognitive alerts', hint: 'Assessment declines' },
  { type: 'behavioral_alert', label: 'Behavioural alerts', hint: 'Critical observations' },
  { type: 'connection_request', label: 'Care team requests', hint: 'Caregiver and doctor links' },
  { type: 'security', label: 'Security', hint: 'Password and sign-in events' },
  { type: 'system', label: 'System announcements', hint: 'Maintenance and broadcasts' },
];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function NotificationSettingsScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const push = usePushNotifications();
  const settings = useQuery({ queryKey: qk.notificationSettings, queryFn: notificationApi.getSettings });
  const devices = useQuery({ queryKey: qk.pushTokens, queryFn: notificationApi.pushTokens });

  const [draft, setDraft] = useState<NotificationSettings | null>(null);
  const [timeErrors, setTimeErrors] = useState<{ start?: string; end?: string }>({});
  const [lastTest, setLastTest] = useState<AppNotification | null>(null);
  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (payload: NotificationSettingsPayload) => notificationApi.updateSettings(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.notificationSettings, data);
      toast.success('Notification settings saved.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const test = useMutation({
    mutationFn: () => notificationApi.sendTest('high'),
    onSuccess: (n) => {
      setLastTest(n);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Test notification sent.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const forget = useMutation({
    mutationFn: (token: string) => notificationApi.removePushToken(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.pushTokens }),
  });

  if (settings.isPending || !draft) return <LoadingState label="Loading settings…" />;
  if (settings.isError && !settings.data) return <ErrorState error={settings.error} onRetry={settings.refetch} />;

  const submit = () => {
    const next: typeof timeErrors = {};
    if (draft.quietHours.enabled) {
      if (!TIME_RE.test(draft.quietHours.start)) next.start = 'Use HH:MM (24h)';
      if (!TIME_RE.test(draft.quietHours.end)) next.end = 'Use HH:MM (24h)';
    }
    setTimeErrors(next);
    if (Object.keys(next).length) return;
    save.mutate({
      channels: draft.channels,
      types: draft.types,
      quietHours: draft.quietHours,
      smsPhone: draft.smsPhone,
      voiceAlerts: draft.voiceAlerts,
      dailySummaryEmail: draft.dailySummaryEmail,
    });
  };

  return (
    <Screen onRefresh={() => Promise.all([settings.refetch(), devices.refetch()])}>
      <AppText tone="muted">Choose how and when you are alerted. Critical alerts (overdue medication, escalations) always get through.</AppText>

      <SectionHeader title="Channels" icon="radio-outline" />
      <Card>
        <ToggleRow label="In-app" description="Alerts inside the app and the bell icon" value={draft.channels.inApp} onChange={(v) => setDraft({ ...draft, channels: { ...draft.channels, inApp: v } })} />
        <ToggleRow label="Push notifications" description={push.status === 'granted' ? `This device is registered${push.token ? '' : ' for local reminders'}` : push.status === 'unsupported' ? 'Not available on this platform' : 'Lock-screen alerts, even when the app is closed'} value={draft.channels.push} onChange={(v) => setDraft({ ...draft, channels: { ...draft.channels, push: v } })} />
        {push.status === 'denied' || push.status === 'undetermined' ? <Button title="Allow notifications on this device" icon="notifications-outline" variant="secondary" onPress={push.requestPermission} /> : null}
        {push.lastError ? (
          <AppText variant="caption" tone="faint">
            {push.lastError}
          </AppText>
        ) : null}
        <ToggleRow label="Email" description="Missed-dose and summary emails" value={draft.channels.email} onChange={(v) => setDraft({ ...draft, channels: { ...draft.channels, email: v } })} />
        <ToggleRow label="SMS (urgent only)" description="Text messages for high and critical alerts" value={draft.channels.sms} onChange={(v) => setDraft({ ...draft, channels: { ...draft.channels, sms: v } })} />
        {draft.channels.sms && (
          <TextField label="SMS phone number" icon="call-outline" value={draft.smsPhone} onChangeText={(v) => setDraft({ ...draft, smsPhone: v })} keyboardType="phone-pad" placeholder="+92 300 1234567" hint="Leave empty to use the phone number on your profile" />
        )}
        <ToggleRow label="Voice alerts" description="Read reminders aloud when they arrive" value={draft.voiceAlerts} onChange={(v) => setDraft({ ...draft, voiceAlerts: v })} />
      </Card>

      <SectionHeader title="Quiet hours" icon="moon-outline" />
      <Card>
        <ToggleRow label="Enable quiet hours" description="Only critical alerts use push, email or SMS during this window" value={draft.quietHours.enabled} onChange={(v) => setDraft({ ...draft, quietHours: { ...draft.quietHours, enabled: v } })} />
        {draft.quietHours.enabled && (
          <View style={screenStyles.row}>
            <View style={screenStyles.flex}>
              <TextField label="From" value={draft.quietHours.start} onChangeText={(v) => setDraft({ ...draft, quietHours: { ...draft.quietHours, start: v } })} placeholder="22:00" error={timeErrors.start} />
            </View>
            <View style={screenStyles.flex}>
              <TextField label="Until" value={draft.quietHours.end} onChangeText={(v) => setDraft({ ...draft, quietHours: { ...draft.quietHours, end: v } })} placeholder="07:00" error={timeErrors.end} />
            </View>
          </View>
        )}
      </Card>

      <SectionHeader title="Alert types" icon="list-outline" />
      <Card>
        {TYPE_LABELS.map((t) => (
          <ToggleRow key={t.type} label={t.label} description={t.hint} value={draft.types[t.type] !== false} onChange={(v) => setDraft({ ...draft, types: { ...draft.types, [t.type]: v } })} />
        ))}
      </Card>

      <Button title="Save settings" icon="save-outline" onPress={submit} loading={save.isPending} size="lg" />

      <SectionHeader title="Test & devices" icon="phone-portrait-outline" />
      <Card>
        <Button title="Send me a test alert" icon="send-outline" variant="secondary" onPress={() => test.mutate()} loading={test.isPending} />
        {lastTest ? (
          <View style={screenStyles.gap}>
            <AppText variant="caption" tone="muted">
              Sent {formatDateTime(lastTest.createdAt)} — what each channel did:
            </AppText>
            <DeliveryPills deliveries={lastTest.deliveries ?? []} verbose />
          </View>
        ) : null}
        <AppText variant="label" tone="faint">
          Registered devices
        </AppText>
        {devices.data && devices.data.length > 0 ? (
          devices.data.map((d) => (
            <View key={d._id} style={[screenStyles.row, { alignItems: 'center' }]}>
              <View style={screenStyles.flex}>
                <AppText weight="600">{d.deviceName || humanise(d.platform)}</AppText>
                <AppText variant="caption" tone="faint">
                  {humanise(d.platform)} · last seen {formatDateTime(d.lastSeenAt)}
                </AppText>
              </View>
              <Button title="Forget" variant="ghost" onPress={() => forget.mutate(d.token)} />
            </View>
          ))
        ) : (
          <AppText variant="caption" tone="faint" color={colors.textFaint}>
            No device is registered for push yet. Push registration needs a development build; Expo Go only supports local reminders.
          </AppText>
        )}
      </Card>
    </Screen>
  );
}
