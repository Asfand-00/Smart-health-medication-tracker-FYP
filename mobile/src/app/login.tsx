/**
 * Login — port of pages/auth/LoginPage.jsx.
 * Validation, messages and 401 handling match the web page. After a successful
 * login the auth guard flips and the root index redirects to the role's home.
 */
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../api/client';
import { AppText } from '../components/ui/AppText';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Form';
import { useTheme } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { spacing } from '../theme';
import { EMAIL_RE } from '../utils/format';

export default function LoginScreen() {
  const { login } = useAuth();
  const toast = useToast();
  const { colors, highContrast } = useTheme();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const next: typeof errors = {};
    if (!email) next.email = 'Email is required';
    else if (!EMAIL_RE.test(email)) next.email = 'Enter a valid email';
    if (!password) next.password = 'Password is required';
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      const err = e as ApiError;
      toast.error(err.message || 'Login failed. Please try again.');
      if (err.kind === 'unauthorized') setErrors({ password: 'Invalid email or password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={[styles.logo, { backgroundColor: highContrast ? '#000' : colors.primary, borderColor: '#fff', borderWidth: highContrast ? 2 : 0 }]}>
              <Ionicons name="pulse" size={30} color="#fff" />
            </View>
            <AppText variant="display" align="center" accessibilityRole="header">
              MedTracker
            </AppText>
            <AppText tone="muted" align="center">
              Manage medications, track health vitals, and stay connected with your care team.
            </AppText>
          </View>

          <View style={styles.form}>
            <AppText variant="title">Welcome back</AppText>
            <AppText tone="faint">Sign in to your account to continue</AppText>
            <TextField
              label="Email address"
              icon="mail-outline"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
              }}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              error={errors.email}
            />
            <TextField
              ref={passwordRef}
              label="Password"
              icon="lock-closed-outline"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
              }}
              placeholder="Enter your password"
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              error={errors.password}
            />
            <Button title={loading ? 'Signing in…' : 'Sign In'} onPress={submit} loading={loading} size="lg" fullWidth />
            <View style={styles.footer}>
              <AppText tone="faint">Don't have an account? </AppText>
              <Link href="/register" asChild>
                <AppText tone="primary" weight="700" accessibilityRole="link" suppressHighlighting>
                  Create one free
                </AppText>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xxl, maxWidth: 520, width: '100%', alignSelf: 'center' },
  brand: { alignItems: 'center', gap: spacing.sm },
  logo: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  form: { gap: spacing.md },
  footer: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', paddingVertical: spacing.sm },
});
