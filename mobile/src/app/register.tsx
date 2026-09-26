/**
 * Register — port of pages/auth/RegisterPage.jsx (2-step form).
 * Step 1: personal info (same client rules as web: name, email, password ≥ 6
 * chars with a digit, confirmation). Step 2: role (patient/caregiver/doctor —
 * admin registration is blocked by the backend). Server field errors from
 * express-validator are mapped back onto the fields.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ApiError } from '../api/client';
import { AppText } from '../components/ui/AppText';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Form';
import { useTheme } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { radius, spacing } from '../theme';
import type { RegisterPayload } from '../types/models';
import { EMAIL_RE } from '../utils/format';

const ROLES: { value: RegisterPayload['role']; label: string; icon: string; desc: string }[] = [
  { value: 'patient', label: 'Patient', icon: '🏥', desc: 'Track my medications' },
  { value: 'caregiver', label: 'Caregiver', icon: '🤝', desc: 'Help manage a patient' },
  { value: 'doctor', label: 'Doctor', icon: '👨‍⚕️', desc: 'Manage my patients' },
];

type Form = RegisterPayload & { confirmPassword: string };
type Errors = Partial<Record<keyof Form, string>>;

export default function RegisterScreen() {
  const { register } = useAuth();
  const toast = useToast();
  const theme = useTheme();
  const { colors } = theme;

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [form, setForm] = useState<Form>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'patient',
    phone: '',
  });

  const set = (key: keyof Form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validateStep1 = (): Errors => {
    const e: Errors = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required';
    else if (form.firstName.trim().length < 2) e.firstName = 'At least 2 characters';
    if (!form.lastName.trim()) e.lastName = 'Last name is required';
    else if (form.lastName.trim().length < 2) e.lastName = 'At least 2 characters';
    if (!form.email) e.email = 'Email is required';
    else if (!EMAIL_RE.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'At least 6 characters';
    else if (!/\d/.test(form.password)) e.password = 'Must contain a number';
    if (!form.confirmPassword) e.confirmPassword = 'Please confirm your password';
    else if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    return e;
  };

  const next = () => {
    const e = validateStep1();
    setErrors(e);
    if (Object.keys(e).length === 0) setStep(2);
  };

  const submit = async () => {
    setLoading(true);
    try {
      const { confirmPassword: _unused, ...payload } = form;
      await register({ ...payload, email: payload.email.trim(), phone: payload.phone?.trim() || undefined });
    } catch (e) {
      const err = e as ApiError;
      if (err.fieldErrors.length > 0) {
        const mapped: Errors = {};
        err.fieldErrors.forEach((f) => {
          mapped[f.field as keyof Form] = f.message;
        });
        setErrors(mapped);
        setStep(1);
        toast.error('Please fix the errors below.');
      } else {
        toast.error(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.fill, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.gap}>
          <AppText tone="faint">
            Step {step} of 2 — {step === 1 ? 'Your information' : 'Choose your role'}
          </AppText>
          <View style={[styles.progress, { backgroundColor: colors.surfaceAlt }]} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 2, now: step }}>
            <View style={[styles.progressFill, { width: step === 1 ? '50%' : '100%', backgroundColor: colors.primary }]} />
          </View>
        </View>

        {step === 1 ? (
          <View style={styles.gap}>
            <View style={styles.row}>
              <View style={styles.fill}>
                <TextField label="First name" icon="person-outline" value={form.firstName} onChangeText={set('firstName')} placeholder="Ahmed" error={errors.firstName} autoComplete="given-name" />
              </View>
              <View style={styles.fill}>
                <TextField label="Last name" value={form.lastName} onChangeText={set('lastName')} placeholder="Khan" error={errors.lastName} autoComplete="family-name" />
              </View>
            </View>
            <TextField
              label="Email address"
              icon="mail-outline"
              value={form.email}
              onChangeText={set('email')}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email}
            />
            <TextField label="Phone (optional)" icon="call-outline" value={form.phone} onChangeText={set('phone')} placeholder="+92 300 1234567" keyboardType="phone-pad" autoComplete="tel" />
            <TextField
              label="Password"
              icon="lock-closed-outline"
              value={form.password}
              onChangeText={set('password')}
              placeholder="Min 6 chars, include a number"
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              error={errors.password}
            />
            <TextField
              label="Confirm password"
              icon="lock-closed-outline"
              value={form.confirmPassword}
              onChangeText={set('confirmPassword')}
              placeholder="Re-enter your password"
              secureTextEntry
              error={errors.confirmPassword}
            />
            <Button title="Next: Choose role →" onPress={next} size="lg" fullWidth />
          </View>
        ) : (
          <View style={styles.gap}>
            <AppText tone="muted">Choose the role that best describes you. This determines which features you can access.</AppText>
            <View accessibilityRole="radiogroup" style={styles.gap}>
              {ROLES.map((r) => {
                const selected = form.role === r.value;
                return (
                  <Pressable
                    key={r.value}
                    onPress={() => setForm((f) => ({ ...f, role: r.value }))}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`${r.label}. ${r.desc}`}
                    style={[
                      styles.roleCard,
                      {
                        backgroundColor: selected ? (theme.highContrast ? '#000' : 'rgba(59,130,246,0.14)') : colors.surface,
                        borderColor: selected ? (theme.highContrast ? '#ffff00' : colors.primary) : colors.border,
                        borderWidth: selected || theme.highContrast ? 2 : 1,
                      },
                    ]}
                  >
                    <AppText style={styles.roleIcon}>{r.icon}</AppText>
                    <View style={styles.fill}>
                      <AppText variant="heading">{r.label}</AppText>
                      <AppText tone="faint">{r.desc}</AppText>
                    </View>
                    <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.borderStrong }]}>
                      {selected && <View style={[styles.radioDot, { backgroundColor: theme.highContrast ? '#ffff00' : colors.primary }]} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.row}>
              <Button title="← Back" variant="secondary" onPress={() => setStep(1)} style={styles.fill} />
              <Button title={loading ? 'Creating…' : 'Create account'} onPress={submit} loading={loading} style={styles.fill} />
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.xl, maxWidth: 560, width: '100%', alignSelf: 'center' },
  gap: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  progress: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%' },
  roleCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, minHeight: 72 },
  roleIcon: { fontSize: 28, lineHeight: 36 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
