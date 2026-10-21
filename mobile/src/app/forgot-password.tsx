/**
 * Account recovery — 3 steps:
 *  1. email          → POST /auth/forgot-password (6-digit code by email)
 *  2. code + new pw  → POST /auth/reset-password  (signs the user in)
 * In development without SMTP the backend returns the code (`devCode`) so the
 * flow can be exercised; it is shown here only when present.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, errorMessage } from '../api/client';
import { authApi } from '../api/services';
import { AppText } from '../components/ui/AppText';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { TextField } from '../components/ui/Form';
import { useTheme } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { spacing } from '../theme';
import { EMAIL_RE } from '../utils/format';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const { updateUser } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [expires, setExpires] = useState(15);
  const [errors, setErrors] = useState<{ email?: string; code?: string; password?: string; confirm?: string }>({});
  const [loading, setLoading] = useState(false);

  const requestCode = async () => {
    if (!EMAIL_RE.test(email)) return setErrors({ email: 'Enter a valid email' });
    setErrors({});
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email.trim());
      setDevCode(res.devCode ?? null);
      setExpires(res.expiresInMinutes);
      setStep(2);
      toast.success('If that email exists, a 6-digit code is on its way.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    const next: typeof errors = {};
    if (!/^\d{6}$/.test(code.trim())) next.code = 'Enter the 6-digit code';
    if (password.length < 6) next.password = 'At least 6 characters';
    else if (!/\d/.test(password)) next.password = 'Must contain a number';
    if (password !== confirm) next.confirm = 'Passwords do not match';
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    try {
      const result = await authApi.resetPassword(email.trim(), code.trim(), password);
      // The reset endpoint signs the user in; reuse the normal login path so
      // the token is persisted exactly as a login would.
      await updateUser(result.user);
      toast.success('Password reset. Please sign in with your new password.');
      router.replace('/login');
    } catch (e) {
      const err = e as ApiError;
      toast.error(err.message);
      if (err.kind === 'validation') setErrors({ code: 'Invalid or expired code' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppText variant="title" accessibilityRole="header">
            {step === 1 ? 'Forgot your password?' : 'Enter the recovery code'}
          </AppText>
          <AppText tone="muted">
            {step === 1
              ? 'Enter the email address of your account. We will send a 6-digit code to it (and to your recovery email, if you set one).'
              : `We sent a code to ${email}. It expires in ${expires} minutes.`}
          </AppText>

          {step === 1 ? (
            <View style={styles.form}>
              <TextField
                label="Email address"
                icon="mail-outline"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (errors.email) setErrors({});
                }}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={errors.email}
              />
              <Button title="Send recovery code" icon="paper-plane-outline" onPress={requestCode} loading={loading} size="lg" fullWidth />
            </View>
          ) : (
            <View style={styles.form}>
              {devCode ? (
                <Card accent={colors.warning}>
                  <AppText variant="caption" weight="700">
                    Development mode: the server has no email account configured, so your code is shown here.
                  </AppText>
                  <AppText variant="display" align="center" style={styles.code}>
                    {devCode}
                  </AppText>
                </Card>
              ) : null}
              <TextField label="6-digit code" icon="key-outline" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="123456" error={errors.code} />
              <TextField label="New password" icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry placeholder="Min 6 chars, include a number" error={errors.password} />
              <TextField label="Confirm new password" icon="lock-closed-outline" value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Re-enter your password" error={errors.confirm} />
              <Button title="Reset password" icon="checkmark" onPress={reset} loading={loading} size="lg" fullWidth />
              <Button title="Send a new code" variant="ghost" onPress={requestCode} disabled={loading} />
            </View>
          )}

          <Button title="Back to sign in" variant="secondary" icon="arrow-back" onPress={() => router.replace('/login')} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg, maxWidth: 520, width: '100%', alignSelf: 'center' },
  form: { gap: spacing.md },
  code: { letterSpacing: 8 },
});
