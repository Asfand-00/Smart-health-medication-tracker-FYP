/**
 * Emergency contacts — port of pages/EmergencyContactsPage.jsx (patient and caregiver).
 * CRUD via /caregiver-dashboard/emergency-contacts. "Call now" opens the phone
 * dialer (web: <a href="tel:">), and email opens the mail app.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { errorMessage } from '../api/client';
import { qk } from '../api/queryClient';
import { caregiverDashboardApi } from '../api/services';
import { PatientSelector, useCaregiverPatients } from '../components/PatientSelector';
import { AppText } from '../components/ui/AppText';
import { Button, IconButton } from '../components/ui/Button';
import { Card, Pill } from '../components/ui/Card';
import { TextField, ToggleRow } from '../components/ui/Form';
import { Screen, screenStyles } from '../components/ui/Screen';
import { Sheet } from '../components/ui/Sheet';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { useTheme } from '../context/AccessibilityContext';
import { useCurrentUser } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { EmergencyContact } from '../types/models';
import { confirmAction } from '../utils/confirm';

const EMPTY = { name: '', relation: '', phone: '', email: '', isPrimary: false, canReceiveAlerts: true };

export default function EmergencyContactsScreen() {
  const user = useCurrentUser();
  const isCaregiver = user.role === 'caregiver';
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const caregiver = useCaregiverPatients(undefined, isCaregiver);
  const patientId = isCaregiver ? caregiver.selectedId : user._id || user.id;

  const contacts = useQuery({
    queryKey: qk.emergencyContacts(patientId),
    queryFn: () => caregiverDashboardApi.getEmergencyContacts(patientId),
    enabled: Boolean(patientId),
  });

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  const openForm = (c: EmergencyContact | null) => {
    setEditingId(c?._id ?? null);
    setForm(c ? { name: c.name, relation: c.relation, phone: c.phone, email: c.email ?? '', isPrimary: c.isPrimary, canReceiveAlerts: c.canReceiveAlerts } : EMPTY);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        patientUserId: patientId,
        name: form.name.trim(),
        relation: form.relation.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        isPrimary: form.isPrimary,
        canReceiveAlerts: form.canReceiveAlerts,
      };
      return editingId ? caregiverDashboardApi.updateEmergencyContact(editingId, payload) : caregiverDashboardApi.addEmergencyContact(payload);
    },
    onSuccess: () => {
      toast.success(editingId ? 'Emergency contact updated successfully!' : 'Emergency contact added successfully!');
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: qk.emergencyContacts(patientId) });
    },
    onError: (e) => toast.error(errorMessage(e) || 'Failed to save emergency contact.'),
  });

  const remove = useMutation({
    mutationFn: caregiverDashboardApi.deleteEmergencyContact,
    onSuccess: () => {
      toast.success('Emergency contact deleted.');
      queryClient.invalidateQueries({ queryKey: qk.emergencyContacts(patientId) });
    },
    onError: () => toast.error('Failed to delete contact.'),
  });

  const call = async (phone: string) => {
    const url = `tel:${phone.replace(/[^\d+]/g, '')}`;
    try {
      await Linking.openURL(url);
    } catch {
      toast.error('Calling is not available on this device.');
    }
  };

  if (isCaregiver) {
    if (caregiver.query.isPending) return <LoadingState label="Loading patients…" />;
    if (caregiver.query.isError && !caregiver.query.data) return <ErrorState error={caregiver.query.error} onRetry={caregiver.query.refetch} />;
    if (caregiver.patients.length === 0) return <EmptyState icon="people-outline" title="No assigned patients found" />;
  }

  const ownerName = isCaregiver && caregiver.selected ? `${caregiver.selected.firstName}'s` : 'Your';
  const list = contacts.data ?? [];

  return (
    <Screen onRefresh={() => contacts.refetch()}>
      {isCaregiver && <PatientSelector patients={caregiver.patients} selectedId={caregiver.selectedId} onSelect={caregiver.setSelectedId} />}
      <AppText tone="muted">Emergency dialers & medical escalation contacts. Tap to call instantly.</AppText>
      <Button title="Add trusted contact" icon="person-add-outline" onPress={() => openForm(null)} />

      <AppText variant="heading">
        {ownerName} trusted contacts ({list.length})
      </AppText>
      {contacts.isPending ? (
        <LoadingState />
      ) : contacts.isError ? (
        <ErrorState error={contacts.error} onRetry={contacts.refetch} />
      ) : list.length === 0 ? (
        <EmptyState
          icon="folder-open-outline"
          title="No emergency contacts registered"
          message="Create contacts that caregivers or the patient can instantly notify during escalations."
        />
      ) : (
        list.map((c) => (
          <Card key={c._id} accent={c.isPrimary ? colors.danger : undefined}>
            <View style={screenStyles.row}>
              <View style={screenStyles.flex}>
                <AppText variant="heading">{c.name}</AppText>
                <AppText variant="caption" tone="faint">{c.relation}</AppText>
              </View>
              <IconButton icon="create-outline" accessibilityLabel={`Edit ${c.name}`} onPress={() => openForm(c)} />
              <IconButton
                icon="trash-outline"
                color={colors.danger}
                accessibilityLabel={`Delete ${c.name}`}
                onPress={async () => {
                  if (await confirmAction('Delete contact', 'Are you sure you want to delete this emergency contact?')) remove.mutate(c._id);
                }}
              />
            </View>
            <View style={screenStyles.wrap}>
              {c.isPrimary && <Pill label="Primary" color={colors.danger} />}
              {c.canReceiveAlerts && <Pill label="Alerts on" color={colors.teal} />}
            </View>
            <AppText>📞 {c.phone}</AppText>
            {c.email ? (
              <AppText tone="primary" onPress={() => Linking.openURL(`mailto:${c.email}`)} accessibilityRole="link">
                ✉️ {c.email}
              </AppText>
            ) : null}
            <Button title="Call now" icon="call" variant="success" size="lg" onPress={() => call(c.phone)} accessibilityLabel={`Call ${c.name} at ${c.phone}`} />
          </Card>
        ))
      )}

      <Card>
        <AppText variant="heading">Need help?</AppText>
        <AppText variant="caption" tone="muted">
          Primary contacts are the people to reach first if there are repeated unacknowledged medications or critical behavioral observations.
        </AppText>
      </Card>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={editingId ? '✏️ Edit contact' : '➕ Add trusted contact'}
        subtitle="Save a reliable friend, relative, or doctor"
        footer={
          <>
            <Button title="Cancel" variant="secondary" onPress={() => setOpen(false)} style={screenStyles.flex} />
            <Button
              title="Save"
              icon="checkmark"
              onPress={() => save.mutate()}
              disabled={!form.name.trim() || !form.relation.trim() || !form.phone.trim()}
              loading={save.isPending}
              style={screenStyles.flex}
            />
          </>
        }
      >
        <TextField label="Full name" required value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Sarah Smith" autoComplete="name" />
        <TextField label="Relation" required value={form.relation} onChangeText={(v) => setForm((f) => ({ ...f, relation: v }))} placeholder="e.g. Daughter, Spouse, Doctor" />
        <TextField label="Phone number" required value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" placeholder="e.g. +1 555 019 2834" />
        <TextField label="Email (optional)" value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" placeholder="e.g. sarah@example.com" />
        <ToggleRow label="Primary contact" value={form.isPrimary} onChange={(v) => setForm((f) => ({ ...f, isPrimary: v }))} />
        <ToggleRow label="Automated adherence alerts" value={form.canReceiveAlerts} onChange={(v) => setForm((f) => ({ ...f, canReceiveAlerts: v }))} />
      </Sheet>
    </Screen>
  );
}
