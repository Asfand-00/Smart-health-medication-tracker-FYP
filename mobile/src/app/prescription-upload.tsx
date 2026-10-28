/**
 * New prescription — POST /prescriptions (multipart).
 * Attach a photo (camera / gallery) or a PDF, or type the prescription text
 * and let the server extract the medication plan (FR11). The extracted list
 * can be corrected before saving.
 */
import { useMutation } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';

import { errorMessage } from '../api/client';
import { prescriptionApi } from '../api/services';
import { AppText } from '../components/ui/AppText';
import { Button, IconButton } from '../components/ui/Button';
import { Card, Pill, SectionHeader } from '../components/ui/Card';
import { ChipGroup, DateField, TextField } from '../components/ui/Form';
import { Screen, screenStyles } from '../components/ui/Screen';
import { useTheme } from '../context/AccessibilityContext';
import { useCurrentUser } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { PickedFile, PrescribedMedication, TimeOfDay } from '../types/models';
import { TIMES_OF_DAY } from '../types/models';
import { toDateKey } from '../utils/format';

const MAX_MB = 10;

export default function PrescriptionUploadScreen() {
  const router = useRouter();
  const user = useCurrentUser();
  const toast = useToast();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ patientId?: string; name?: string }>();
  const isDoctor = user.role === 'doctor';

  const [title, setTitle] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [issuedDate, setIssuedDate] = useState(toDateKey(new Date()));
  const [expiryDate, setExpiryDate] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [rawText, setRawText] = useState('');
  const [medications, setMedications] = useState<PrescribedMedication[]>([]);
  const [unparsed, setUnparsed] = useState<string[]>([]);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [errors, setErrors] = useState<{ title?: string; patient?: string }>({});

  const needsPatient = user.role !== 'patient' && !params.patientId;

  const pickImage = async (fromCamera: boolean) => {
    try {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return toast.error('Camera permission is needed to photograph the prescription.');
      }
      const res = fromCamera ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      if (a.fileSize && a.fileSize > MAX_MB * 1024 * 1024) return toast.error(`The image is larger than ${MAX_MB} MB.`);
      setFile({ uri: a.uri, name: a.fileName || `prescription-${Date.now()}.jpg`, mimeType: a.mimeType || 'image/jpeg', size: a.fileSize, file: a.file });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true, multiple: false });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      if (a.size && a.size > MAX_MB * 1024 * 1024) return toast.error(`The file is larger than ${MAX_MB} MB.`);
      setFile({ uri: a.uri, name: a.name, mimeType: a.mimeType || 'application/pdf', size: a.size, file: a.file });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const parse = useMutation({
    mutationFn: () => prescriptionApi.parseText(rawText),
    onSuccess: (r) => {
      setMedications(r.medications);
      setUnparsed(r.unparsed);
      toast.success(`${r.medications.length} medication${r.medications.length === 1 ? '' : 's'} extracted. Check them before saving.`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const save = useMutation({
    mutationFn: () =>
      prescriptionApi.create(
        {
          patientUserId: params.patientId,
          title: title.trim(),
          doctorName: isDoctor ? undefined : doctorName.trim(),
          issuedDate,
          expiryDate: expiryDate || undefined,
          diagnosis: diagnosis.trim(),
          notes: notes.trim(),
          rawText: rawText.trim(),
          medications: medications.filter((m) => m.medicineName.trim()),
        },
        file,
      ),
    onSuccess: (p) => {
      toast.success(p.status === 'verified' ? 'Prescription issued.' : 'Prescription uploaded — waiting for doctor verification.');
      router.replace(`/prescription/${p._id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submit = () => {
    const next: typeof errors = {};
    if (!title.trim()) next.title = 'Give the prescription a title';
    if (needsPatient) next.patient = 'Open this screen from a patient so the prescription is linked to them';
    setErrors(next);
    if (Object.keys(next).length) return;
    if (!file && !rawText.trim() && medications.length === 0) return toast.error('Attach a document, type the prescription text, or add at least one medication.');
    save.mutate();
  };

  const updateMed = (i: number, patch: Partial<PrescribedMedication>) => setMedications((l) => l.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const addMed = () => setMedications((l) => [...l, { medicineName: '', dosage: '', frequency: 'daily', timeOfDay: ['Morning'], durationDays: null, instructions: '' }]);

  return (
    <Screen>
      {params.name ? (
        <Card accent={colors.purple}>
          <AppText weight="700">For {params.name}</AppText>
        </Card>
      ) : null}
      {errors.patient ? <AppText tone="danger">{errors.patient}</AppText> : null}

      <SectionHeader title="Details" icon="reader-outline" />
      <Card>
        <TextField label="Title" required value={title} onChangeText={setTitle} placeholder="e.g. Neurology visit — March" error={errors.title} />
        {!isDoctor && <TextField label="Prescribing doctor" value={doctorName} onChangeText={setDoctorName} placeholder="Dr. …" />}
        <DateField label="Issued on" value={issuedDate} onChange={setIssuedDate} maximumDate={new Date()} />
        <DateField label="Valid until (optional)" optional value={expiryDate} onChange={setExpiryDate} />
        <TextField label="Diagnosis" value={diagnosis} onChangeText={setDiagnosis} placeholder="e.g. Alzheimer's disease" />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
      </Card>

      <SectionHeader title="Document" icon="attach-outline" />
      <Card>
        <AppText variant="caption" tone="faint">
          Photos and PDFs are encrypted on the server and only visible to the patient's care team. Max {MAX_MB} MB.
        </AppText>
        {file ? (
          <View style={screenStyles.gap}>
            {file.mimeType.startsWith('image/') ? <Image source={{ uri: file.uri }} style={styles.preview} resizeMode="contain" accessibilityLabel="Selected prescription image" /> : null}
            <View style={[screenStyles.row, { alignItems: 'center' }]}>
              <AppText style={screenStyles.flex} numberOfLines={1}>
                📎 {file.name}
                {file.size ? ` (${Math.round(file.size / 1024)} KB)` : ''}
              </AppText>
              <IconButton icon="close-circle" accessibilityLabel="Remove file" onPress={() => setFile(null)} />
            </View>
          </View>
        ) : null}
        <View style={screenStyles.row}>
          {Platform.OS !== 'web' && <Button title="Camera" icon="camera-outline" variant="secondary" onPress={() => pickImage(true)} style={screenStyles.flex} />}
          <Button title="Photo" icon="image-outline" variant="secondary" onPress={() => pickImage(false)} style={screenStyles.flex} />
          <Button title="PDF / file" icon="document-outline" variant="secondary" onPress={pickDocument} style={screenStyles.flex} />
        </View>
      </Card>

      <SectionHeader title="Prescription text → plan" icon="sparkles-outline" />
      <Card>
        <AppText variant="caption" tone="faint">
          Type or paste the prescription, one medicine per line, e.g. "Donepezil 10mg once daily at night for 30 days". The server extracts name, dose, times and duration.
        </AppText>
        <TextField value={rawText} onChangeText={setRawText} multiline placeholder={'Donepezil 10mg once daily at night for 30 days\nMetformin 500 mg BD after meals x 2 weeks'} accessibilityLabel="Prescription text" />
        <Button title="Extract medications" icon="sparkles-outline" variant="secondary" onPress={() => parse.mutate()} disabled={!rawText.trim()} loading={parse.isPending} />
        {unparsed.length > 0 && (
          <AppText variant="caption" color={colors.warning}>
            Could not read: {unparsed.join(' · ')}
          </AppText>
        )}
      </Card>

      <SectionHeader title={`Medications (${medications.length})`} icon="medkit-outline" action={<Button title="Add" variant="ghost" icon="add" onPress={addMed} />} />
      {medications.length === 0 ? (
        <Card>
          <AppText tone="faint">No medications listed yet. Extract them from the text above or add them by hand.</AppText>
        </Card>
      ) : (
        medications.map((m, i) => (
          <Card key={i}>
            <View style={screenStyles.row}>
              <AppText weight="700" style={screenStyles.flex}>
                Medicine {i + 1}
              </AppText>
              {typeof m.confidence === 'number' && m.confidence < 0.7 ? <Pill label="check this" color={colors.warning} /> : null}
              <IconButton icon="trash-outline" color={colors.danger} accessibilityLabel="Remove medicine" onPress={() => setMedications((l) => l.filter((_, idx) => idx !== i))} />
            </View>
            {m.sourceLine ? (
              <AppText variant="caption" tone="faint">
                From: "{m.sourceLine}"
              </AppText>
            ) : null}
            <TextField label="Medicine name" required value={m.medicineName} onChangeText={(v) => updateMed(i, { medicineName: v })} autoCapitalize="words" />
            <View style={screenStyles.row}>
              <View style={screenStyles.flex}>
                <TextField label="Dosage" value={m.dosage} onChangeText={(v) => updateMed(i, { dosage: v })} placeholder="10mg" />
              </View>
              <View style={screenStyles.flex}>
                <TextField label="Days" value={m.durationDays ? String(m.durationDays) : ''} onChangeText={(v) => updateMed(i, { durationDays: v ? Number(v) || null : null })} keyboardType="numeric" placeholder="ongoing" />
              </View>
            </View>
            <ChipGroup label="Time of day" multiple options={TIMES_OF_DAY.map((t) => ({ value: t, label: t }))} selected={m.timeOfDay} onToggle={(t: TimeOfDay) => updateMed(i, { timeOfDay: m.timeOfDay.includes(t) ? m.timeOfDay.filter((x) => x !== t) : [...m.timeOfDay, t] })} />
            <TextField label="Instructions" value={m.instructions} onChangeText={(v) => updateMed(i, { instructions: v })} placeholder="after meals" />
          </Card>
        ))
      )}

      <Button title={isDoctor ? 'Issue prescription' : 'Save prescription'} icon="cloud-upload-outline" size="lg" onPress={submit} loading={save.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({ preview: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#000' } });
