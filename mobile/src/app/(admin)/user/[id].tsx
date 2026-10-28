/**
 * Admin user detail — GET /admin/users/:id, role change, password reset,
 * unlock, activity trail, and (for patients) links to their clinical data.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { errorMessage } from '../../../api/client';
import { qk } from '../../../api/queryClient';
import { adminApi } from '../../../api/services';
import { AppText } from '../../../components/ui/AppText';
import { Button } from '../../../components/ui/Button';
import { Avatar, Card, KeyValue, ListItem, Pill, SectionHeader } from '../../../components/ui/Card';
import { SelectField, TextField } from '../../../components/ui/Form';
import { Screen, screenStyles } from '../../../components/ui/Screen';
import { Sheet } from '../../../components/ui/Sheet';
import { ErrorState, LoadingState } from '../../../components/ui/States';
import { useTheme } from '../../../context/AccessibilityContext';
import { useCurrentUser } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import type { Role } from '../../../types/models';
import { confirmAction } from '../../../utils/confirm';
import { formatDateTime, fullName, humanise, initials, ROLE_LABEL } from '../../../utils/format';

const ROLES: { value: Role; label: string }[] = [
  { value: 'patient', label: 'Patient' },
  { value: 'caregiver', label: 'Caregiver' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'admin', label: 'Admin' },
];

export default function AdminUserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useCurrentUser();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: qk.adminUser(id), queryFn: () => adminApi.user(id) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

  const [role, setRole] = useState<Role | ''>('');
  const setRoleMut = useMutation({ mutationFn: (r: Role) => adminApi.setRole(id, r), onSuccess: () => { toast.success('Role changed; the user must sign in again.'); invalidate(); }, onError: (e) => toast.error(errorMessage(e)) });
  const [pwOpen, setPwOpen] = useState(false);
  const [tempPw, setTempPw] = useState('');
  const resetPw = useMutation({
    mutationFn: (pw?: string) => adminApi.resetPassword(id, pw),
    onSuccess: (r, pw) => {
      toast.success(pw ? 'Temporary password set; other sessions signed out.' : `Reset code emailed to the user${r?.devCode ? ` (dev code ${r.devCode})` : ''}.`);
      setPwOpen(false);
      setTempPw('');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const unlock = useMutation({ mutationFn: () => adminApi.unlock(id), onSuccess: () => toast.success('Account unlocked.'), onError: (e) => toast.error(errorMessage(e)) });
  const setActive = useMutation({ mutationFn: (v: boolean) => adminApi.setStatus(id, v), onSuccess: () => { toast.success('Status updated.'); invalidate(); }, onError: (e) => toast.error(errorMessage(e)) });

  if (detail.isPending) return <LoadingState />;
  if (detail.isError && !detail.data) return <ErrorState error={detail.error} onRetry={detail.refetch} />;
  const d = detail.data!;
  const u = d.user;
  const self = u._id === me._id;
  const patientParams = { patientId: u._id, name: fullName(u) };

  return (
    <Screen onRefresh={() => detail.refetch()}>
      <Card>
        <View style={[screenStyles.row, { alignItems: 'center' }]}>
          <Avatar text={initials(u)} size={56} />
          <View style={screenStyles.flex}>
            <AppText variant="title">{fullName(u)}</AppText>
            <AppText variant="caption" tone="faint">
              {u.email}
            </AppText>
          </View>
        </View>
        <View style={screenStyles.wrap}>
          <Pill label={ROLE_LABEL[u.role]} color={colors.purple} />
          <Pill label={u.isActive ? 'Active' : 'Inactive'} color={u.isActive ? colors.success : colors.textFaint} />
          {u.isEmailVerified ? <Pill label="email verified" color={colors.teal} /> : null}
        </View>
        <KeyValue label="Phone" value={u.phone || '—'} />
        <KeyValue label="Joined" value={formatDateTime(u.createdAt)} />
        <KeyValue label="Last sign-in" value={u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'never'} />
        <KeyValue label="Password changed" value={u.passwordChangedAt ? formatDateTime(u.passwordChangedAt) : '—'} />
        <KeyValue label="Notifications" value={String(d.notifications)} />
        <KeyValue label="Push devices" value={String(d.pushDevices)} />
        {u.role === 'patient' ? <KeyValue label="Medications" value={String(d.medications)} /> : null}
        {u.speciality ? <KeyValue label="Speciality" value={u.speciality} /> : null}
      </Card>

      {u.role === 'patient' ? (
        <>
          <SectionHeader title="Clinical data" icon="pulse-outline" />
          <Card>
            <ListItem title="AI insights" icon="sparkles-outline" onPress={() => router.push({ pathname: '/ai-insights', params: patientParams })} />
            <ListItem title="Health analytics" icon="analytics-outline" onPress={() => router.push({ pathname: '/analytics', params: patientParams })} />
            <ListItem title="Medication calendar" icon="calendar-outline" onPress={() => router.push({ pathname: '/calendar', params: patientParams })} />
            <ListItem title="Prescriptions" icon="document-attach-outline" onPress={() => router.push({ pathname: '/prescriptions', params: patientParams })} />
          </Card>
        </>
      ) : null}

      <SectionHeader title="Account actions" icon="construct-outline" />
      <Card>
        <SelectField label="Change role" value={role || u.role} options={ROLES} onChange={(r) => setRole(r)} disabled={self} />
        {role && role !== u.role ? <Button title={`Set role to ${ROLE_LABEL[role]}`} icon="swap-horizontal-outline" onPress={() => setRoleMut.mutate(role)} loading={setRoleMut.isPending} /> : null}
        {!self && <Button title={u.isActive ? 'Deactivate account' : 'Activate account'} icon={u.isActive ? 'pause-circle-outline' : 'play-circle-outline'} variant={u.isActive ? 'danger' : 'success'} onPress={async () => { if (!u.isActive || (await confirmAction('Deactivate', `${fullName(u)} will be signed out and unable to log in.`, 'Deactivate'))) setActive.mutate(!u.isActive); }} />}
        <Button title="Reset password" icon="key-outline" variant="secondary" onPress={() => setPwOpen(true)} />
        <Button title="Unlock (clear failed logins)" icon="lock-open-outline" variant="secondary" onPress={() => unlock.mutate()} loading={unlock.isPending} />
      </Card>

      <SectionHeader title="Recent activity" icon="list-outline" />
      <Card>
        {d.activity.length === 0 ? (
          <AppText tone="faint">No activity recorded.</AppText>
        ) : (
          d.activity.map((a) => (
            <View key={a._id} style={screenStyles.row}>
              <Pill label={a.status} color={a.status === 'success' ? colors.success : a.status === 'denied' ? colors.warning : colors.danger} />
              <View style={screenStyles.flex}>
                <AppText variant="caption" weight="600">
                  {humanise(a.action)}
                </AppText>
                <AppText variant="caption" tone="faint">
                  {formatDateTime(a.createdAt)}
                  {a.ip ? ` · ${a.ip}` : ''}
                </AppText>
              </View>
            </View>
          ))
        )}
      </Card>

      <Sheet
        visible={pwOpen}
        onClose={() => setPwOpen(false)}
        title="Reset password"
        footer={
          <>
            <Button title="Email a reset code" variant="secondary" onPress={() => resetPw.mutate(undefined)} loading={resetPw.isPending && !resetPw.variables} style={screenStyles.flex} />
            <Button title="Set temporary password" icon="checkmark" disabled={tempPw.length < 6 || !/\d/.test(tempPw)} onPress={() => resetPw.mutate(tempPw)} loading={resetPw.isPending && Boolean(resetPw.variables)} style={screenStyles.flex} />
          </>
        }
      >
        <AppText tone="muted">Either email the user a 6-digit recovery code, or set a temporary password to hand over in person. Both sign the user out everywhere.</AppText>
        <TextField label="Temporary password" value={tempPw} onChangeText={setTempPw} secureTextEntry hint="At least 6 characters including a number" />
      </Sheet>
    </Screen>
  );
}
