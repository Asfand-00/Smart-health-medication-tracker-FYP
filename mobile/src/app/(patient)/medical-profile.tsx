/**
 * Medical profile — port of pages/dashboards/PatientProfilePage.jsx.
 * GET /patient/profile (404 → first-time setup, starts in edit mode),
 * PUT /patient/profile upserts. Comma-separated lists become arrays, as on web.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ApiError, errorMessage } from '../../api/client';
import { qk } from '../../api/queryClient';
import { patientApi } from '../../api/services';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card, SectionHeader } from '../../components/ui/Card';
import { DateField, SelectField, TextField } from '../../components/ui/Form';
import { Screen, screenStyles } from '../../components/ui/Screen';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { useToast } from '../../context/ToastContext';
import type { BloodGroup, Gender, PatientProfile } from '../../types/models';
import { BLOOD_GROUPS } from '../../types/models';
import { dateOnlyKey, isDateKey, numberOrUndefined, splitList } from '../../utils/format';

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const EMPTY = {
  dateOfBirth: '',
  gender: 'prefer_not_to_say' as Gender,
  bloodGroup: 'Unknown' as BloodGroup,
  height: '',
  weight: '',
  chronicDiseases: '',
  allergies: '',
  pastSurgeries: '',
  emergencyContactName: '',
  emergencyContactRelation: '',
  emergencyContactPhone: '',
};
type Form = typeof EMPTY;

function toForm(p: PatientProfile): Form {
  return {
    dateOfBirth: p.dateOfBirth ? dateOnlyKey(p.dateOfBirth) : '',
    gender: p.gender || 'prefer_not_to_say',
    bloodGroup: p.bloodGroup || 'Unknown',
    height: p.height != null ? String(p.height) : '',
    weight: p.weight != null ? String(p.weight) : '',
    chronicDiseases: p.medicalHistory?.chronicDiseases?.join(', ') ?? '',
    allergies: p.medicalHistory?.allergies?.join(', ') ?? '',
    pastSurgeries: p.medicalHistory?.pastSurgeries?.join(', ') ?? '',
    emergencyContactName: p.emergencyContact?.name ?? '',
    emergencyContactRelation: p.emergencyContact?.relation ?? '',
    emergencyContactPhone: p.emergencyContact?.phone ?? '',
  };
}

export default function MedicalProfileScreen() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: qk.patientProfile,
    queryFn: patientApi.getProfile,
    retry: false,
  });
  const notFound = profile.error instanceof ApiError && profile.error.kind === 'not_found';

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [dobError, setDobError] = useState<string>();

  useEffect(() => {
    if (profile.data) setForm(toForm(profile.data));
  }, [profile.data]);

  useEffect(() => {
    if (notFound) {
      setEditing(true);
      toast.info('👋 Please complete your medical profile setup.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notFound]);

  const save = useMutation({
    mutationFn: () =>
      patientApi.upsertProfile({
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        bloodGroup: form.bloodGroup,
        height: numberOrUndefined(form.height) ?? null,
        weight: numberOrUndefined(form.weight) ?? null,
        medicalHistory: {
          chronicDiseases: splitList(form.chronicDiseases),
          allergies: splitList(form.allergies),
          pastSurgeries: splitList(form.pastSurgeries),
        },
        emergencyContact: {
          name: form.emergencyContactName.trim(),
          relation: form.emergencyContactRelation.trim(),
          phone: form.emergencyContactPhone.trim(),
        },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.patientProfile, data);
      toast.success('Medical profile saved successfully!');
      setEditing(false);
    },
    onError: (e) => toast.error(errorMessage(e) || 'Failed to save profile.'),
  });

  const set = <K extends keyof Form>(key: K) => (value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    if (!form.dateOfBirth || !isDateKey(form.dateOfBirth)) {
      const msg = form.dateOfBirth ? 'Use a valid date (YYYY-MM-DD)' : 'Date of birth is required';
      setDobError(msg);
      toast.error(msg);
      return;
    }
    setDobError(undefined);
    save.mutate();
  };

  if (profile.isPending) return <LoadingState label="Loading medical profile…" />;
  if (profile.isError && !notFound) return <ErrorState error={profile.error} onRetry={profile.refetch} />;

  const disabled = !editing;

  return (
    <Screen onRefresh={notFound ? undefined : () => profile.refetch()}>
      <View style={screenStyles.gap}>
        <AppText tone="muted">Keep your medical data accurate for better care.</AppText>
        {!editing && <Button title="Edit profile" icon="create-outline" onPress={() => setEditing(true)} />}
      </View>

      <SectionHeader title="Basic details" icon="person-outline" />
      <Card>
        <DateField label="Date of birth" required value={form.dateOfBirth} onChange={set('dateOfBirth')} disabled={disabled} maximumDate={new Date()} error={dobError} />
        <SelectField label="Gender" required value={form.gender} options={GENDERS} onChange={set('gender')} disabled={disabled} />
        <SelectField label="Blood group" value={form.bloodGroup} options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))} onChange={set('bloodGroup')} disabled={disabled} />
        <View style={screenStyles.row}>
          <View style={screenStyles.flex}>
            <TextField label="Height (cm)" value={form.height} onChangeText={set('height')} editable={!disabled} keyboardType="numeric" placeholder="175" />
          </View>
          <View style={screenStyles.flex}>
            <TextField label="Weight (kg)" value={form.weight} onChangeText={set('weight')} editable={!disabled} keyboardType="decimal-pad" placeholder="70" />
          </View>
        </View>
      </Card>

      <SectionHeader title="Medical history" icon="pulse-outline" />
      <Card>
        <AppText variant="caption" tone="faint">
          Separate multiple items with commas (e.g. "Diabetes, Asthma").
        </AppText>
        <TextField label="Chronic diseases" value={form.chronicDiseases} onChangeText={set('chronicDiseases')} editable={!disabled} placeholder="None" />
        <TextField label="Allergies" value={form.allergies} onChangeText={set('allergies')} editable={!disabled} placeholder="Penicillin, Peanuts…" />
        <TextField label="Past surgeries" value={form.pastSurgeries} onChangeText={set('pastSurgeries')} editable={!disabled} placeholder="Appendectomy (2018)" />
      </Card>

      <SectionHeader title="Emergency contact" icon="alert-circle-outline" />
      <Card>
        <TextField label="Contact name" value={form.emergencyContactName} onChangeText={set('emergencyContactName')} editable={!disabled} placeholder="Jane Doe" />
        <TextField label="Relationship" value={form.emergencyContactRelation} onChangeText={set('emergencyContactRelation')} editable={!disabled} placeholder="Spouse" />
        <TextField label="Phone number" value={form.emergencyContactPhone} onChangeText={set('emergencyContactPhone')} editable={!disabled} placeholder="+1 234 567 890" keyboardType="phone-pad" />
      </Card>

      {editing && (
        <View style={screenStyles.row}>
          {!notFound && (
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => {
                if (profile.data) setForm(toForm(profile.data));
                setEditing(false);
              }}
              style={screenStyles.flex}
            />
          )}
          <Button title="Save profile" icon="save-outline" onPress={submit} loading={save.isPending} style={screenStyles.flex} />
        </View>
      )}
    </Screen>
  );
}
