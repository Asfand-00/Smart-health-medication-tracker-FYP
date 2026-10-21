/**
 * Treatment templates (FR12) — GET /medication-templates, apply one to a
 * patient in one tap (POST /:id/apply), save your own and delete it.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { errorMessage } from '../api/client';
import { qk } from '../api/queryClient';
import { templateApi } from '../api/services';
import { PatientPicker, usePatientContext } from '../components/PatientContext';
import { AppText } from '../components/ui/AppText';
import { Button, IconButton } from '../components/ui/Button';
import { Card, Pill, SectionHeader } from '../components/ui/Card';
import { ChipGroup, TextField } from '../components/ui/Form';
import { Screen, screenStyles } from '../components/ui/Screen';
import { Sheet } from '../components/ui/Sheet';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { useTheme } from '../context/AccessibilityContext';
import { useCurrentUser } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { MedicationTemplate, TemplateItem, TimeOfDay } from '../types/models';
import { TIMES_OF_DAY } from '../types/models';
import { confirmAction } from '../utils/confirm';

const emptyItem = (): TemplateItem => ({ medicineName: '', dosage: '', frequency: 'daily', timeOfDay: ['Morning'], durationDays: null, notes: '' });

export default function TemplatesScreen() {
  const { colors } = useTheme();
  const user = useCurrentUser();
  const toast = useToast();
  const queryClient = useQueryClient();
  const ctx = usePatientContext();
  const templates = useQuery({ queryKey: qk.templates, queryFn: templateApi.list });

  const apply = useMutation({
    mutationFn: (t: MedicationTemplate) => templateApi.apply(t._id, ctx.patientParam),
    onSuccess: (r, t) => {
      toast.success(`${r.created.length} medication${r.created.length === 1 ? '' : 's'} added from "${t.name}"${r.skipped ? ` (${r.skipped} already on the schedule)` : ''}.`);
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      queryClient.invalidateQueries({ queryKey: ['caregiver'] });
      queryClient.invalidateQueries({ queryKey: ['doctor'] });
      queryClient.invalidateQueries({ queryKey: qk.templates });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: templateApi.remove,
    onSuccess: () => {
      toast.success('Template deleted');
      queryClient.invalidateQueries({ queryKey: qk.templates });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  // create sheet
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [items, setItems] = useState<TemplateItem[]>([emptyItem()]);
  const create = useMutation({
    mutationFn: () => templateApi.create({ name: name.trim(), description: description.trim(), category: category.trim() || 'My templates', items: items.filter((i) => i.medicineName.trim() && i.dosage.trim()), isGlobal: user.role === 'doctor' || user.role === 'admin' }),
    onSuccess: () => {
      toast.success('Template saved');
      setOpen(false);
      setName('');
      setDescription('');
      setCategory('');
      setItems([emptyItem()]);
      queryClient.invalidateQueries({ queryKey: qk.templates });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const validItems = items.filter((i) => i.medicineName.trim() && i.dosage.trim() && i.timeOfDay.length);
  const updateItem = (i: number, patch: Partial<TemplateItem>) => setItems((list) => list.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const list = templates.data ?? [];
  const categories = [...new Set(list.map((t) => t.category))];
  const canApply = ctx.isSelf || Boolean(ctx.patientParam);

  return (
    <Screen onRefresh={() => templates.refetch()}>
      <AppText tone="muted">Common treatment plans you can apply to {ctx.isSelf ? 'your' : "a patient's"} schedule in one tap. Medicines already on the schedule are skipped.</AppText>
      <PatientPicker ctx={ctx} />
      <Button title="Create my own template" icon="add-circle-outline" variant="secondary" onPress={() => setOpen(true)} />

      {templates.isPending ? (
        <LoadingState />
      ) : templates.isError ? (
        <ErrorState error={templates.error} onRetry={templates.refetch} />
      ) : list.length === 0 ? (
        <EmptyState icon="albums-outline" title="No templates yet" />
      ) : (
        categories.map((cat) => (
          <View key={cat} style={screenStyles.gap}>
            <SectionHeader title={cat} icon="albums-outline" />
            {list
              .filter((t) => t.category === cat)
              .map((t) => (
                <Card key={t._id}>
                  <View style={screenStyles.row}>
                    <View style={screenStyles.flex}>
                      <AppText variant="heading">{t.name}</AppText>
                      {t.description ? (
                        <AppText variant="caption" tone="muted">
                          {t.description}
                        </AppText>
                      ) : null}
                    </View>
                    {!t.isGlobal || user.role === 'admin' ? (
                      <IconButton
                        icon="trash-outline"
                        color={colors.danger}
                        accessibilityLabel={`Delete template ${t.name}`}
                        onPress={async () => {
                          if (await confirmAction('Delete template', `Delete "${t.name}"?`)) remove.mutate(t._id);
                        }}
                      />
                    ) : null}
                  </View>
                  {t.items.map((it, i) => (
                    <View key={it._id ?? i} style={[screenStyles.row, { alignItems: 'center' }]}>
                      <AppText style={screenStyles.flex}>
                        <AppText weight="700">{it.medicineName}</AppText> {it.dosage} · {it.timeOfDay.join(', ')}
                        {it.durationDays ? ` · ${it.durationDays} days` : ''}
                      </AppText>
                    </View>
                  ))}
                  <View style={screenStyles.wrap}>
                    <Pill label={t.isGlobal ? 'Standard' : 'Mine'} color={t.isGlobal ? colors.teal : colors.purple} />
                    {t.usageCount > 0 ? <Pill label={`Used ${t.usageCount}×`} color={colors.textFaint} /> : null}
                  </View>
                  <Button
                    title={ctx.isSelf ? 'Apply to my schedule' : `Apply to ${ctx.selected?.name ?? 'patient'}`}
                    icon="download-outline"
                    disabled={!canApply || apply.isPending}
                    loading={apply.isPending && apply.variables?._id === t._id}
                    onPress={async () => {
                      if (await confirmAction('Apply template', `Add ${t.items.length} medication(s) from "${t.name}" to the schedule?`, 'Apply', false)) apply.mutate(t);
                    }}
                  />
                </Card>
              ))}
          </View>
        ))
      )}

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="New template"
        footer={
          <>
            <Button title="Cancel" variant="secondary" onPress={() => setOpen(false)} style={screenStyles.flex} />
            <Button title="Save template" icon="checkmark" onPress={() => create.mutate()} disabled={!name.trim() || validItems.length === 0} loading={create.isPending} style={screenStyles.flex} />
          </>
        }
      >
        <TextField label="Name" required value={name} onChangeText={setName} placeholder="e.g. Evening routine" />
        <TextField label="Category" value={category} onChangeText={setCategory} placeholder="My templates" />
        <TextField label="Description" value={description} onChangeText={setDescription} multiline />
        {items.map((it, i) => (
          <Card key={i}>
            <View style={screenStyles.row}>
              <AppText weight="700" style={screenStyles.flex}>
                Medicine {i + 1}
              </AppText>
              {items.length > 1 && <IconButton icon="close" accessibilityLabel="Remove medicine" onPress={() => setItems((l) => l.filter((_, idx) => idx !== i))} />}
            </View>
            <TextField label="Medicine name" required value={it.medicineName} onChangeText={(v) => updateItem(i, { medicineName: v })} autoCapitalize="words" />
            <TextField label="Dosage" required value={it.dosage} onChangeText={(v) => updateItem(i, { dosage: v })} placeholder="e.g. 500mg" />
            <ChipGroup
              label="Time of day"
              multiple
              options={TIMES_OF_DAY.map((t) => ({ value: t, label: t }))}
              selected={it.timeOfDay}
              onToggle={(t: TimeOfDay) => updateItem(i, { timeOfDay: it.timeOfDay.includes(t) ? it.timeOfDay.filter((x) => x !== t) : [...it.timeOfDay, t] })}
            />
            <TextField label="Duration (days, optional)" value={it.durationDays ? String(it.durationDays) : ''} onChangeText={(v) => updateItem(i, { durationDays: v ? Number(v) || null : null })} keyboardType="numeric" />
            <TextField label="Notes" value={it.notes} onChangeText={(v) => updateItem(i, { notes: v })} />
          </Card>
        ))}
        <Button title="Add another medicine" icon="add" variant="ghost" onPress={() => setItems((l) => [...l, emptyItem()])} />
      </Sheet>
    </Screen>
  );
}
