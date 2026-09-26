/**
 * Admin dashboard — port of pages/dashboards/AdminDashboard.jsx.
 * GET /user/all (active users), counts by role, search, edit (PUT /user/:id)
 * and delete (DELETE /user/:id). The web table becomes a searchable list.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { errorMessage } from '../api/client';
import { qk } from '../api/queryClient';
import { adminApi } from '../api/services';
import { HeaderActions } from '../components/HeaderActions';
import { AppText } from '../components/ui/AppText';
import { Button, IconButton } from '../components/ui/Button';
import { Avatar, Card, Pill, StatTile } from '../components/ui/Card';
import { SelectField, TextField, ToggleRow } from '../components/ui/Form';
import { screenStyles, useRefresh } from '../components/ui/Screen';
import { Sheet } from '../components/ui/Sheet';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { useTheme } from '../context/AccessibilityContext';
import { useAuth, useCurrentUser } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { AdminUser, AdminUserUpdatePayload, Role } from '../types/models';
import { confirmAction } from '../utils/confirm';
import { EMAIL_RE, fullName, initials, ROLE_LABEL } from '../utils/format';

const ROLES: { value: Role; label: string }[] = [
  { value: 'patient', label: 'Patient' },
  { value: 'caregiver', label: 'Caregiver' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'admin', label: 'Admin' },
];

export default function AdminScreen() {
  const me = useCurrentUser();
  const { logout } = useAuth();
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: qk.adminUsers, queryFn: adminApi.getAllUsers });

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<AdminUserUpdatePayload>({ firstName: '', lastName: '', email: '', role: 'patient', isActive: true });
  const [formError, setFormError] = useState<string>();

  const update = useMutation({
    mutationFn: () => adminApi.updateUser(editing!._id, { ...form, firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim() }),
    onSuccess: () => {
      toast.success('User updated successfully');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: qk.adminUsers });
    },
    onError: (e) => toast.error(errorMessage(e) || 'Failed to update user'),
  });

  const remove = useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: (_d, id) => {
      toast.success('User deleted successfully');
      queryClient.setQueryData<AdminUser[]>(qk.adminUsers, (prev) => prev?.filter((u) => u._id !== id));
    },
    onError: () => toast.error('Failed to delete user'),
  });

  const all = users.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((u) => [u.firstName, u.lastName, u.email].some((f) => f?.toLowerCase().includes(q)));
  }, [all, search]);

  const count = (r: Role) => all.filter((u) => u.role === r).length;
  const { refreshing, refresh } = useRefresh(() => users.refetch());

  const openEdit = (u: AdminUser) => {
    setEditing(u);
    setFormError(undefined);
    setForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role, isActive: u.isActive });
  };

  const submit = () => {
    if (form.firstName.trim().length < 2 || form.lastName.trim().length < 2) return setFormError('Names must be at least 2 characters.');
    if (!EMAIL_RE.test(form.email)) return setFormError('Enter a valid email.');
    setFormError(undefined);
    update.mutate();
  };

  const header = (
    <View style={screenStyles.gap}>
      <Card>
        <AppText variant="title">System overview ⚙️</AppText>
        <AppText variant="caption" tone="faint">Logged in as admin · {me.email}</AppText>
      </Card>
      <View style={screenStyles.wrap}>
        <StatTile label="Total users" value={all.length} icon="people-outline" color={colors.primary} />
        <StatTile label="Patients" value={count('patient')} icon="pulse-outline" color={colors.teal} />
        <StatTile label="Caregivers" value={count('caregiver')} icon="heart-outline" color={colors.purple} />
        <StatTile label="Doctors" value={count('doctor')} icon="medkit-outline" color={colors.success} />
      </View>
      <TextField icon="search-outline" placeholder="Search users…" value={search} onChangeText={setSearch} accessibilityLabel="Search users by name or email" autoCapitalize="none" />
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={screenStyles.row}>
              <HeaderActions />
              <IconButton
                icon="log-out-outline"
                accessibilityLabel="Sign out"
                onPress={async () => {
                  if (await confirmAction('Sign out', 'Are you sure you want to sign out?', 'Sign out')) await logout();
                }}
              />
            </View>
          ),
        }}
      />
      {users.isPending ? (
        <LoadingState label="Loading users…" />
      ) : users.isError && !users.data ? (
        <ErrorState error={users.error} onRetry={users.refetch} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(u) => u._id}
          style={{ backgroundColor: colors.bg }}
          contentContainerStyle={screenStyles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          ListHeaderComponent={header}
          ListEmptyComponent={<EmptyState icon="search-outline" title="No users found." />}
          renderItem={({ item: u }) => (
            <Card>
              <View style={[screenStyles.row, { alignItems: 'center' }]}>
                <Avatar text={initials(u)} />
                <View style={screenStyles.flex}>
                  <AppText weight="700">{fullName(u)}</AppText>
                  <AppText variant="caption" tone="faint" numberOfLines={1}>{u.email}</AppText>
                </View>
                <IconButton icon="create-outline" accessibilityLabel={`Edit ${fullName(u)}`} onPress={() => openEdit(u)} />
                <IconButton
                  icon="trash-outline"
                  color={colors.danger}
                  disabled={u._id === me._id}
                  accessibilityLabel={u._id === me._id ? 'You cannot delete your own account' : `Delete ${fullName(u)}`}
                  onPress={async () => {
                    if (await confirmAction('Delete user', `Delete ${fullName(u)}? This action cannot be undone.`)) remove.mutate(u._id);
                  }}
                  style={u._id === me._id ? { opacity: 0.3 } : undefined}
                />
              </View>
              <View style={screenStyles.wrap}>
                <Pill label={ROLE_LABEL[u.role]} color={u.role === 'admin' ? colors.danger : u.role === 'doctor' ? colors.teal : u.role === 'caregiver' ? colors.purple : colors.primary} />
                <Pill label={u.isActive ? 'Active' : 'Inactive'} color={u.isActive ? colors.success : colors.textFaint} />
              </View>
            </Card>
          )}
        />
      )}

      <Sheet
        visible={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit user"
        footer={
          <>
            <Button title="Cancel" variant="secondary" onPress={() => setEditing(null)} style={screenStyles.flex} />
            <Button title="Save changes" onPress={submit} loading={update.isPending} style={screenStyles.flex} />
          </>
        }
      >
        <TextField label="First name" value={form.firstName} onChangeText={(v) => setForm((f) => ({ ...f, firstName: v }))} />
        <TextField label="Last name" value={form.lastName} onChangeText={(v) => setForm((f) => ({ ...f, lastName: v }))} />
        <TextField label="Email" value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" />
        <SelectField label="Role" value={form.role} options={ROLES} onChange={(v) => setForm((f) => ({ ...f, role: v }))} />
        <ToggleRow
          label="Account is active"
          description="Inactive accounts cannot sign in and are hidden from this list"
          value={form.isActive}
          onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
        />
        {formError ? <AppText tone="danger">{formError}</AppText> : null}
      </Sheet>
    </>
  );
}
