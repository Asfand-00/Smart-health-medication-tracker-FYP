/**
 * Prescription records — GET /prescriptions (own, or per patient for
 * caregivers/doctors), status filter, archive view, upload entry point.
 * Used at /prescriptions and as the doctor's "Prescriptions" tab.
 */
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { qk } from '../api/queryClient';
import { prescriptionApi } from '../api/services';
import { PatientPicker, usePatientContext } from '../components/PatientContext';
import { PrescriptionStatusPill } from '../components/PrescriptionStatusPill';
import { AppText } from '../components/ui/AppText';
import { Button } from '../components/ui/Button';
import { Card, ListItem } from '../components/ui/Card';
import { SegmentedControl } from '../components/ui/Form';
import { Screen, screenStyles } from '../components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { useTheme } from '../context/AccessibilityContext';
import { useCurrentUser } from '../context/AuthContext';
import type { UserRef } from '../types/models';
import { formatDateOnly, fullName } from '../utils/format';

type Filter = '' | 'pending' | 'verified' | 'archived';

export function PrescriptionsScreen() {
  const router = useRouter();
  const user = useCurrentUser();
  const { colors } = useTheme();
  const ctx = usePatientContext();
  const [filter, setFilter] = useState<Filter>('');
  // Doctors see every assigned patient's prescriptions at once when no patient is chosen.
  const allForDoctor = user.role === 'doctor';
  const patientParam = allForDoctor ? undefined : ctx.patientParam;

  const list = useQuery({
    queryKey: qk.prescriptions(allForDoctor ? 'all' : ctx.patientId, filter),
    queryFn: () => prescriptionApi.list(patientParam, filter === 'archived' ? undefined : filter || undefined, filter === 'archived'),
    enabled: allForDoctor || Boolean(ctx.patientId),
  });

  return (
    <Screen onRefresh={() => list.refetch()}>
      <AppText tone="muted">
        {user.role === 'doctor'
          ? 'Prescriptions uploaded by your patients and their caregivers wait here for your verification. You can also issue new ones.'
          : 'Upload doctor prescriptions as a photo, PDF or typed text. A doctor verifies them; then they can be applied to the medication schedule.'}
      </AppText>
      {!allForDoctor && <PatientPicker ctx={ctx} />}
      <Button title={user.role === 'doctor' ? 'Issue a prescription' : 'Upload prescription'} icon="cloud-upload-outline" onPress={() => router.push({ pathname: '/prescription-upload', params: ctx.patientParam ? { patientId: ctx.patientParam, name: ctx.selected?.name } : {} })} disabled={!allForDoctor && !ctx.patientId} />
      <SegmentedControl<Filter> value={filter} onChange={setFilter} options={[{ value: '', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'verified', label: 'Verified' }, { value: 'archived', label: 'Archived' }]} />

      {list.isPending ? (
        <LoadingState label="Loading prescriptions…" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={list.refetch} />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState icon="document-attach-outline" title="No prescriptions" message={filter ? 'Nothing matches this filter.' : 'Uploaded prescriptions appear here.'} />
      ) : (
        <Card>
          {list.data!.map((p, i) => (
            <View key={p._id}>
              {i > 0 ? <View style={{ height: 1, backgroundColor: colors.border }} /> : null}
              <ListItem
                title={p.title}
                subtitle={`${p.doctorName || 'Doctor not named'} · ${formatDateOnly(p.issuedDate)} · ${p.medications.length} medication${p.medications.length === 1 ? '' : 's'}${allForDoctor ? ` · ${fullName(p.patientUserId as UserRef)}` : ''}${p.file?.originalName ? ' · 📎' : ''}`}
                icon={p.file?.mimeType === 'application/pdf' ? 'document-text-outline' : p.file?.originalName ? 'image-outline' : 'reader-outline'}
                right={<PrescriptionStatusPill status={p.status} />}
                onPress={() => router.push(`/prescription/${p._id}`)}
              />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
