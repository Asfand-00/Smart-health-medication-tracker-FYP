/**
 * Platform configuration — GET/PUT /admin/config: maintenance mode,
 * registration, default reminder times, escalation timing, AI thresholds,
 * channel switches, security policy, prescription rules.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { errorMessage } from '../../../api/client';
import { qk } from '../../../api/queryClient';
import { adminApi } from '../../../api/services';
import { AppText } from '../../../components/ui/AppText';
import { Button } from '../../../components/ui/Button';
import { Card, SectionHeader } from '../../../components/ui/Card';
import { ChipGroup, TextField, ToggleRow } from '../../../components/ui/Form';
import { Screen, screenStyles } from '../../../components/ui/Screen';
import { ErrorState, LoadingState } from '../../../components/ui/States';
import { useTheme } from '../../../context/AccessibilityContext';
import { useToast } from '../../../context/ToastContext';
import type { SystemConfig, TimeOfDay } from '../../../types/models';
import { TIMES_OF_DAY } from '../../../types/models';
import { formatDateTime } from '../../../utils/format';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function AdminConfig() {
  const toast = useToast();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: qk.adminConfig, queryFn: adminApi.getConfig });
  const [draft, setDraft] = useState<SystemConfig | null>(null);
  useEffect(() => {
    if (config.data) setDraft(config.data);
  }, [config.data]);

  const save = useMutation({
    mutationFn: () => adminApi.updateConfig(draft!),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.adminConfig, data);
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast.success('Configuration saved.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (config.isPending || !draft) return <LoadingState />;
  if (config.isError && !config.data) return <ErrorState error={config.error} onRetry={config.refetch} />;

  const num = (v: string) => (v === '' ? 0 : Number(v));
  const submit = () => {
    for (const t of TIMES_OF_DAY) if (!TIME_RE.test(draft.reminderTimes[t])) return toast.error(`${t} time must be HH:MM.`);
    if (draft.ai.alertThreshold <= 0 || draft.ai.alertThreshold >= 1) return toast.error('AI alert threshold must be between 0 and 1.');
    save.mutate();
  };

  return (
    <Screen onRefresh={() => config.refetch()}>
      <AppText variant="caption" tone="faint">
        Last updated {draft.updatedAt ? formatDateTime(draft.updatedAt) : '—'}. Changes apply within 30 seconds.
      </AppText>

      <SectionHeader title="Platform" icon="globe-outline" />
      <Card>
        <TextField label="Application name" value={draft.appName} onChangeText={(v) => setDraft({ ...draft, appName: v })} />
        <ToggleRow label="Maintenance mode" description="Everyone except administrators receives 503" value={draft.maintenanceMode} onChange={(v) => setDraft({ ...draft, maintenanceMode: v })} />
        {draft.maintenanceMode && <TextField label="Maintenance message" value={draft.maintenanceMessage} onChangeText={(v) => setDraft({ ...draft, maintenanceMessage: v })} multiline />}
        <ToggleRow label="Allow self-registration" value={draft.allowRegistration} onChange={(v) => setDraft({ ...draft, allowRegistration: v })} />
        <ChipGroup label="Roles that may self-register" multiple options={[{ value: 'patient', label: 'Patient' }, { value: 'caregiver', label: 'Caregiver' }, { value: 'doctor', label: 'Doctor' }]} selected={draft.registrationRoles} onToggle={(r: string) => setDraft({ ...draft, registrationRoles: draft.registrationRoles.includes(r) ? draft.registrationRoles.filter((x) => x !== r) : [...draft.registrationRoles, r] })} />
      </Card>

      <SectionHeader title="Reminders & escalation" icon="alarm-outline" />
      <Card>
        <AppText variant="caption" tone="faint">
          Default clock times for each dose slot (patients can override their own).
        </AppText>
        <View style={screenStyles.wrap}>
          {TIMES_OF_DAY.map((t: TimeOfDay) => (
            <View key={t} style={{ minWidth: 140, flex: 1 }}>
              <TextField label={t} value={draft.reminderTimes[t]} onChangeText={(v) => setDraft({ ...draft, reminderTimes: { ...draft.reminderTimes, [t]: v } })} placeholder="08:00" />
            </View>
          ))}
        </View>
        <TextField label="Grace period (minutes before a pending dose counts as missed)" value={String(draft.gracePeriodMinutes)} onChangeText={(v) => setDraft({ ...draft, gracePeriodMinutes: num(v) })} keyboardType="numeric" />
        <View style={screenStyles.row}>
          <View style={screenStyles.flex}>
            <TextField label="2nd reminder after (min)" value={String(draft.escalation.level2Minutes)} onChangeText={(v) => setDraft({ ...draft, escalation: { ...draft.escalation, level2Minutes: num(v) } })} keyboardType="numeric" />
          </View>
          <View style={screenStyles.flex}>
            <TextField label="Caregiver alert after (min)" value={String(draft.escalation.level3Minutes)} onChangeText={(v) => setDraft({ ...draft, escalation: { ...draft.escalation, level3Minutes: num(v) } })} keyboardType="numeric" />
          </View>
        </View>
      </Card>

      <SectionHeader title="AI prediction" icon="sparkles-outline" />
      <Card>
        <ToggleRow label="AI preventive alerts" description="Hourly missed-dose predictions and risk flags" value={draft.ai.enabled} onChange={(v) => setDraft({ ...draft, ai: { ...draft.ai, enabled: v } })} />
        <View style={screenStyles.row}>
          <View style={screenStyles.flex}>
            <TextField label="Patient alert threshold (0–1)" value={String(draft.ai.alertThreshold)} onChangeText={(v) => setDraft({ ...draft, ai: { ...draft.ai, alertThreshold: Number(v) || 0 } })} keyboardType="decimal-pad" />
          </View>
          <View style={screenStyles.flex}>
            <TextField label="Care team threshold (0–1)" value={String(draft.ai.caregiverAlertThreshold)} onChangeText={(v) => setDraft({ ...draft, ai: { ...draft.ai, caregiverAlertThreshold: Number(v) || 0 } })} keyboardType="decimal-pad" />
          </View>
        </View>
        <TextField label="History analysed (days)" value={String(draft.ai.lookbackDays)} onChangeText={(v) => setDraft({ ...draft, ai: { ...draft.ai, lookbackDays: num(v) } })} keyboardType="numeric" />
      </Card>

      <SectionHeader title="Channels" icon="radio-outline" />
      <Card>
        <ToggleRow label="Email" value={draft.channels.emailEnabled} onChange={(v) => setDraft({ ...draft, channels: { ...draft.channels, emailEnabled: v } })} />
        <ToggleRow label="SMS" value={draft.channels.smsEnabled} onChange={(v) => setDraft({ ...draft, channels: { ...draft.channels, smsEnabled: v } })} />
        <ToggleRow label="Push" value={draft.channels.pushEnabled} onChange={(v) => setDraft({ ...draft, channels: { ...draft.channels, pushEnabled: v } })} />
      </Card>

      <SectionHeader title="Security policy" icon="lock-closed-outline" />
      <Card>
        <View style={screenStyles.row}>
          <View style={screenStyles.flex}>
            <TextField label="Max login attempts" value={String(draft.security.maxLoginAttempts)} onChangeText={(v) => setDraft({ ...draft, security: { ...draft.security, maxLoginAttempts: num(v) } })} keyboardType="numeric" />
          </View>
          <View style={screenStyles.flex}>
            <TextField label="Lockout (minutes)" value={String(draft.security.lockoutMinutes)} onChangeText={(v) => setDraft({ ...draft, security: { ...draft.security, lockoutMinutes: num(v) } })} keyboardType="numeric" />
          </View>
        </View>
        <View style={screenStyles.row}>
          <View style={screenStyles.flex}>
            <TextField label="Min password length" value={String(draft.security.passwordMinLength)} onChangeText={(v) => setDraft({ ...draft, security: { ...draft.security, passwordMinLength: num(v) } })} keyboardType="numeric" />
          </View>
          <View style={screenStyles.flex}>
            <TextField label="Session length (days)" value={String(draft.security.sessionDays)} onChangeText={(v) => setDraft({ ...draft, security: { ...draft.security, sessionDays: num(v) } })} keyboardType="numeric" />
          </View>
        </View>
        <ToggleRow label="Password must contain a number" value={draft.security.passwordRequireNumber} onChange={(v) => setDraft({ ...draft, security: { ...draft.security, passwordRequireNumber: v } })} />
        <TextField label="Recovery code validity (minutes)" value={String(draft.security.otpExpiryMinutes)} onChangeText={(v) => setDraft({ ...draft, security: { ...draft.security, otpExpiryMinutes: num(v) } })} keyboardType="numeric" />
      </Card>

      <SectionHeader title="Prescriptions" icon="document-attach-outline" />
      <Card>
        <ToggleRow label="Require doctor verification before applying" value={draft.prescriptions.requireDoctorVerification} onChange={(v) => setDraft({ ...draft, prescriptions: { ...draft.prescriptions, requireDoctorVerification: v } })} />
        <TextField label="Max upload size (MB)" value={String(draft.prescriptions.maxFileSizeMb)} onChangeText={(v) => setDraft({ ...draft, prescriptions: { ...draft.prescriptions, maxFileSizeMb: num(v) } })} keyboardType="numeric" />
      </Card>

      <Button title="Save configuration" icon="save-outline" size="lg" onPress={submit} loading={save.isPending} />
      <AppText variant="caption" color={colors.textFaint}>
        Every change is recorded in the audit trail with your account.
      </AppText>
    </Screen>
  );
}
