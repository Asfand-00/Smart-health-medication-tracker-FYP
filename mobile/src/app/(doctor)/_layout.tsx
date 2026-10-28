import { Stack } from 'expo-router';

import { useTheme } from '../../context/AccessibilityContext';

export default function DoctorLayout() {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700', fontSize: theme.fs(17) },
        contentStyle: { backgroundColor: colors.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="doctor-patient/[id]" options={{ title: 'Patient overview' }} />
    </Stack>
  );
}
