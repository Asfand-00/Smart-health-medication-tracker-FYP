/**
 * Root layout — providers + auth/role-guarded navigation.
 *
 * Web equivalent: main.jsx (providers) + AppRoutes.jsx + ProtectedRoute.jsx.
 * ProtectedRoute's "not logged in → /login" and "wrong role → own dashboard"
 * rules become Stack.Protected guards: a screen whose guard is false cannot be
 * reached, and when a guard flips (login/logout) the router falls back to the
 * `index` route, which redirects to the right home screen.
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

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AccessibilityProvider>
          <ToastProvider>
            <AuthProvider>
              <SocketProvider>
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
    // web: ProtectedRoute spinner while the saved session is being verified
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
          </Stack.Protected>

          <Stack.Protected guard={isAuthenticated}>
            <Stack.Protected guard={role === 'patient'}>
              <Stack.Screen name="(patient)" options={{ headerShown: false }} />
            </Stack.Protected>
            <Stack.Protected guard={role === 'caregiver'}>
              <Stack.Screen name="(caregiver)" options={{ headerShown: false }} />
            </Stack.Protected>
            <Stack.Protected guard={role === 'doctor'}>
              <Stack.Screen name="doctor" options={{ title: 'Doctor Dashboard' }} />
            </Stack.Protected>
            <Stack.Protected guard={role === 'admin'}>
              <Stack.Screen name="admin" options={{ title: 'Admin Dashboard' }} />
            </Stack.Protected>
            <Stack.Protected guard={role === 'patient' || role === 'caregiver'}>
              <Stack.Screen name="emergency-contacts" options={{ title: 'Emergency Contacts' }} />
              <Stack.Screen name="reports" options={{ title: 'Reports & Risk' }} />
            </Stack.Protected>
            {/* Any signed-in role */}
            <Stack.Screen name="profile" options={{ title: 'My Profile' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
          </Stack.Protected>
        </Stack>
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
