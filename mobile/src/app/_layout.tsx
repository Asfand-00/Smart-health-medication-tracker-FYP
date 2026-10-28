/**
 * Root layout — providers + auth/role-guarded navigation.
 *
 * Role areas are route groups with their own tab bar:
 *   (patient) (caregiver) (doctor) (admin)
 * Shared screens (prescriptions, AI insights, analytics, calendar, …) live at
 * the root and are available to every signed-in role; each checks access
 * through the backend, which rejects anyone not linked to the patient.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '../api/queryClient';
import { OfflineBanner } from '../components/OfflineBanner';
import { LoadingState } from '../components/ui/States';
import { AccessibilityProvider, useTheme } from '../context/AccessibilityContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SocketProvider } from '../context/SocketContext';
import { ToastProvider } from '../context/ToastContext';
import { PushNotificationsBridge } from '../hooks/usePushNotifications';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AccessibilityProvider>
          <ToastProvider>
            <AuthProvider>
              <SocketProvider>
                <PushNotificationsBridge />
                <RootNavigator />
              </SocketProvider>
            </AuthProvider>
          </ToastProvider>
        </AccessibilityProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const theme = useTheme();
  const { colors } = theme;
  const role = user?.role;

  const navTheme = useMemo(
    () => ({
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        primary: theme.highContrast ? '#ffff00' : colors.primary,
        background: colors.bg,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: '#e11d48',
      },
    }),
    [theme, colors],
  );

  if (isLoading) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.bg }]}>
        <StatusBar style="light" />
        <LoadingState label="Loading…" />
      </View>
    );
  }

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />
      <View style={[styles.fill, { backgroundColor: colors.bg }]}>
        <OfflineBanner />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700', fontSize: theme.fs(17) },
            contentStyle: { backgroundColor: colors.bg },
            headerBackButtonDisplayMode: 'minimal',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />

          <Stack.Protected guard={!isAuthenticated}>
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ title: 'Create Account' }} />
            <Stack.Screen name="forgot-password" options={{ title: 'Account recovery' }} />
          </Stack.Protected>

          <Stack.Protected guard={isAuthenticated}>
            <Stack.Protected guard={role === 'patient'}>
              <Stack.Screen name="(patient)" options={{ headerShown: false }} />
            </Stack.Protected>
            <Stack.Protected guard={role === 'caregiver'}>
              <Stack.Screen name="(caregiver)" options={{ headerShown: false }} />
            </Stack.Protected>
            <Stack.Protected guard={role === 'doctor'}>
              <Stack.Screen name="(doctor)" options={{ headerShown: false }} />
            </Stack.Protected>
            <Stack.Protected guard={role === 'admin'}>
              <Stack.Screen name="(admin)" options={{ headerShown: false }} />
            </Stack.Protected>
            <Stack.Protected guard={role === 'patient' || role === 'caregiver'}>
              <Stack.Screen name="emergency-contacts" options={{ title: 'Emergency Contacts' }} />
              <Stack.Screen name="reports" options={{ title: 'Reports & Risk' }} />
            </Stack.Protected>
            <Stack.Protected guard={role !== 'admin'}>
              <Stack.Screen name="plan-requests" options={{ title: 'Medication plan approvals' }} />
              <Stack.Screen name="templates" options={{ title: 'Treatment templates' }} />
            </Stack.Protected>
            {/* Any signed-in role */}
            <Stack.Screen name="profile" options={{ title: 'My Profile' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            <Stack.Screen name="notification-settings" options={{ title: 'Notification settings' }} />
            <Stack.Screen name="activity" options={{ title: 'Account activity' }} />
            <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
            <Stack.Screen name="prescriptions" options={{ title: 'Prescriptions' }} />
            <Stack.Screen name="prescription-upload" options={{ title: 'New prescription' }} />
            <Stack.Screen name="prescription/[id]" options={{ title: 'Prescription' }} />
            <Stack.Screen name="ai-insights" options={{ title: 'AI insights & predictions' }} />
            <Stack.Screen name="analytics" options={{ title: 'Health analytics' }} />
            <Stack.Screen name="calendar" options={{ title: 'Medication calendar' }} />
            <Stack.Screen name="drug-info" options={{ title: 'Drug information' }} />
          </Stack.Protected>
        </Stack>
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
