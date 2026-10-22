/**
 * User & role management — GET /admin/users (search, role, status,
 * pagination), create user, activate/deactivate, change role, reset
 * password, unlock, delete.
 */
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import { errorMessage } from '../../../api/client';
import { qk } from '../../../api/queryClient';
import { adminApi } from '../../../api/services';
import { AppText } from '../../../components/ui/AppText';
import { Button, IconButton } from '../../../components/ui/Button';
import { Avatar, Card, Pill } from '../../../components/ui/Card';
import { SelectField, TextField } from '../../../components/ui/Form';
import { screenStyles, useRefresh } from '../../../components/ui/Screen';
import { Sheet } from '../../../components/ui/Sheet';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import { useTheme } from '../../../context/AccessibilityContext';
import { useCurrentUser } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import type { AdminCreateUserPayload, Role } from '../../../types/models';
import { confirmAction } from '../../../utils/confirm';
import { EMAIL_RE, fullName, initials, ROLE_LABEL } from '../../../utils/format';

const ROLES: { value: Role | ''; label: string }[] = [
  { value: '', label: 'All roles' },
  { value: 'patient', label: 'Patients' },
  { value: 'caregiver', label: 'Caregivers' },
  { value: 'doctor', label: 'Doctors' },
  { value: 'admin', label: 'Admins' },
];
const STATUS = [
  { value: '', label: 'Active & inactive' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function AdminUsers() {
  const me = useCurrentUser();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [status, setStatus] = useState('');
  const filters = { search, role, status };
  const list = useInfiniteQuery({
    queryKey: qk.adminUsersPage(filters),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => adminApi.users({ ...filters, page: pageParam, limit: 25 }),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
  const users = list.data?.pages.flatMap((p) => p.users) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin'] });
  const { refreshing, refresh } = useRefresh(() => list.refetch());

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<AdminCreateUserPayload>({ firstName: '', lastName: '', email: '', password: '', role: 'patient', speciality: '' });
  const [formError, setFormError] = useState<string>();
  const create = useMutation({
    mutationFn: () => adminApi.createUser({ ...form, email: form.email.trim(), firstName: form.firstName.trim(), lastName: form.lastName.trim() }),
    onSuccess: () => {
      toast.success('User created.');
      setCreateOpen(false);
      setForm({ firstName: '', lastName: '', email: '', password: '', role: 'patient', speciality: '' });
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const setActive = useMutation({ mutationFn: (v: { id: string; isActive: boolean }) => adminApi.setStatus(v.id, v.isActive), onSuccess: (_d, v) => { toast.success(v.isActive ? 'Account activated.' : 'Account deactivated and signed out.'); invalidate(); }, onError: (e) => toast.error(errorMessage(e)) });
  const remove = useMutation({ mutationFn: adminApi.deleteUser, onSuccess: () => { toast.success('User deleted.'); invalidate(); }, onError: (e) => toast.error(errorMessage(e)) });

  const submitCreate = () => {
    if (form.firstName.trim().length < 2 || form.lastName.trim().length < 2) return setFormError('Names must be at least 2 characters.');
    if (!EMAIL_RE.test(form.email.trim())) return setFormError('Enter a valid email.');
    if (form.password.length < 6 || !/\d/.test(form.password)) return setFormError('Password: at least 6 characters including a number.');
    setFormError(undefined);
    create.mutate();
  };

  const roleColor = (r: Role) => (r === 'admin' ? colors.danger : r === 'doctor' ? colors.teal : r === 'caregiver' ? colors.purple : colors.primary);

  return (
    <>
      <FlatList
        data={users}
        keyExtractor={(u) => u._id}
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={screenStyles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={screenStyles.gap}>
            <Button title="Create user" icon="person-add-outline" onPress={() => setCreateOpen(true)} />
            <TextField icon="search-outline" placeholder="Search name or email…" value={search} onChangeText={setSearch} autoCapitalize="none" accessibilityLabel="Search users" />
            <View style={screenStyles.row}>
              <View style={screenStyles.flex}>
                <SelectField label="Role" value={role} options={ROLES} onChange={setRole} />
              </View>
              <View style={screenStyles.flex}>
                <SelectField label="Status" value={status} options={STATUS} onChange={setStatus} />
              </View>
            </View>
            <AppText variant="caption" tone="faint">
              {total} user{total === 1 ? '' : 's'}
            </AppText>
          </View>
        }
        ListEmptyComponent={list.isPending ? <LoadingState /> : list.isError ? <ErrorState error={list.error} onRetry={list.refetch} /> : <EmptyState icon="search-outline" title="No users found." />}
        ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null}
        renderItem={({ item: u }) => {
          const self = u._id === me._id;
          return (
            <Card style={!u.isActive ? { opacity: 0.7 } : undefined}>
              <View style={[screenStyles.row, { alignItems: 'center' }]}>
                <Avatar text={initials(u)} color={roleColor(u.role)} />
                <View style={screenStyles.flex}>
                  <AppText weight="700">{fullName(u)}</AppText>
                  <AppText variant="caption" tone="faint" numberOfLines={1}>
                    {u.email}
                  </AppText>
                </View>
                <IconButton icon="open-outline" accessibilityLabel={`Manage ${fullName(u)}`} onPress={() => router.push({ pathname: '/user/[id]', params: { id: u._id } })} />
                <IconButton
                  icon="trash-outline"
                  color={colors.danger}
                  disabled={self}
                  accessibilityLabel={self ? 'You cannot delete your own account' : `Delete ${fullName(u)}`}
                  style={self ? { opacity: 0.3 } : undefined}
                  onPress={async () => {
                    if (await confirmAction('Delete user', `Permanently delete ${fullName(u)}? This cannot be undone.`)) remove.mutate(u._id);
                  }}
                />
              </View>
              <View style={screenStyles.wrap}>
                <Pill label={ROLE_LABEL[u.role]} color={roleColor(u.role)} />
                <Pill label={u.isActive ? 'Active' : 'Inactive'} color={u.isActive ? colors.success : colors.textFaint} />
                {u.lastLoginAt ? <Pill label={`last login ${new Date(u.lastLoginAt).toLocaleDateString()}`} color={colors.textFaint} /> : null}
              </View>
              {!self && (
                <Button title={u.isActive ? 'Deactivate' : 'Activate'} icon={u.isActive ? 'pause-circle-outline' : 'play-circle-outline'} variant={u.isActive ? 'secondary' : 'success'} onPress={() => setActive.mutate({ id: u._id, isActive: !u.isActive })} loading={setActive.isPending && setActive.variables?.id === u._id} />
              )}
            </Card>
          );
        }}
      />

      <Sheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create user"
        subtitle="Any role, including doctors and admins"
        footer={
          <>
            <Button title="Cancel" variant="secondary" onPress={() => setCreateOpen(false)} style={screenStyles.flex} />
            <Button title="Create" icon="checkmark" onPress={submitCreate} loading={create.isPending} style={screenStyles.flex} />
          </>
        }
      >
        <View style={screenStyles.row}>
          <View style={screenStyles.flex}>
            <TextField label="First name" value={form.firstName} onChangeText={(v) => setForm((f) => ({ ...f, firstName: v }))} />
          </View>
          <View style={screenStyles.flex}>
            <TextField label="Last name" value={form.lastName} onChangeText={(v) => setForm((f) => ({ ...f, lastName: v }))} />
          </View>
        </View>
        <TextField label="Email" value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" />
        <TextField label="Temporary password" value={form.password} onChangeText={(v) => setForm((f) => ({ ...f, password: v }))} secureTextEntry hint="At least 6 characters including a number" />
        <SelectField label="Role" value={form.role} options={ROLES.filter((r) => r.value) as { value: Role; label: string }[]} onChange={(v) => setForm((f) => ({ ...f, role: v }))} />
        {form.role === 'doctor' && <TextField label="Speciality" value={form.speciality} onChangeText={(v) => setForm((f) => ({ ...f, speciality: v }))} placeholder="Neurology" />}
        {formError ? <AppText tone="danger">{formError}</AppText> : null}
      </Sheet>
    </>
  );
}
