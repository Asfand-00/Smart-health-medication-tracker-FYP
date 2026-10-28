/**
 * My profile — port of pages/ProfilePage.jsx. PUT /user/profile with
 * firstName, lastName, phone, gender (email is read-only, as on web).
 */
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { errorMessage } from '../api/client';
import { userApi } from '../api/services';
import { AppText } from '../components/ui/AppText';
import { Button } from '../components/ui/Button';
import { Avatar, Card, KeyValue, Pill } from '../components/ui/Card';
import { SelectField, TextField } from '../components/ui/Form';
import { Screen, screenStyles } from '../components/ui/Screen';
import { useTheme } from '../context/AccessibilityContext';
import { useAuth, useCurrentUser } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Gender } from '../types/models';
import { formatDate, fullName, initials, ROLE_LABEL } from '../utils/format';

const GENDERS: { value: Gender | ''; label: string }[] = [
  { value: '', label: 'Prefer not to say' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export default function ProfileScreen() {
  const user = useCurrentUser();
  const { updateUser } = useAuth();
  const { colors } = useTheme();
  const toast = useToast();
  const [editing, setEditing] = useState(false);

  const initial = () => ({
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    phone: user.phone ?? '',
    gender: (user.gender === 'prefer_not_to_say' ? '' : user.gender ?? '') as Gender | '',
  });
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({});

  const save = useMutation({
    mutationFn: () =>
      userApi.updateProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        // '' is not a valid enum value on the backend; send the equivalent.
        gender: form.gender || 'prefer_not_to_say',
      }),
    onSuccess: async (updated) => {
      await updateUser(updated);
      toast.success('Profile updated successfully!');
      setEditing(false);
    },
    onError: (e) => toast.error(errorMessage(e) || 'Update failed.'),
  });

  const submit = () => {
    const next: typeof errors = {};
    if (form.firstName.trim().length < 2) next.firstName = 'At least 2 characters';
    if (form.lastName.trim().length < 2) next.lastName = 'At least 2 characters';
    setErrors(next);
    if (Object.keys(next).length === 0) save.mutate();
  };

  return (
    <Screen>
      <Card style={{ alignItems: 'center' }}>
        <Avatar text={initials(user)} size={72} />
        <AppText variant="title" align="center">{fullName(user)}</AppText>
        <AppText tone="faint">{user.email}</AppText>
        <Pill label={ROLE_LABEL[user.role]} color={colors.purple} />
      </Card>

      <Card>
        <KeyValue label="Email status" value={user.isEmailVerified ? '✓ Verified' : 'Unverified'} />
        <KeyValue label="Account status" value={user.isActive ? 'Active' : 'Inactive'} />
        <KeyValue label="Member since" value={formatDate(user.createdAt, { month: 'short', year: 'numeric' })} />
      </Card>

      <Card>
        <View style={screenStyles.row}>
          <AppText variant="heading" style={screenStyles.flex}>Personal information</AppText>
          {!editing && <Button title="Edit" icon="create-outline" variant="ghost" onPress={() => setEditing(true)} />}
        </View>
        <TextField label="First name" icon="person-outline" value={form.firstName} onChangeText={(v) => setForm((f) => ({ ...f, firstName: v }))} editable={editing} error={errors.firstName} />
        <TextField label="Last name" icon="person-outline" value={form.lastName} onChangeText={(v) => setForm((f) => ({ ...f, lastName: v }))} editable={editing} error={errors.lastName} />
        <TextField label="Email address" icon="mail-outline" value={user.email} editable={false} hint="Email cannot be changed from here for security reasons." />
        <TextField label="Phone number" icon="call-outline" value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} editable={editing} keyboardType="phone-pad" placeholder="+92 300 0000000" />
        <SelectField label="Gender" value={form.gender} options={GENDERS} onChange={(v) => setForm((f) => ({ ...f, gender: v }))} disabled={!editing} />
        {editing && (
          <View style={screenStyles.row}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => {
                setForm(initial());
                setErrors({});
                setEditing(false);
              }}
              style={screenStyles.flex}
            />
            <Button title={save.isPending ? 'Saving…' : 'Save changes'} icon="save-outline" onPress={submit} loading={save.isPending} style={screenStyles.flex} />
          </View>
        )}
      </Card>
    </Screen>
  );
}
