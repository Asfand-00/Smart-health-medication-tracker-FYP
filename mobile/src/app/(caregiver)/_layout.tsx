import { Stack } from 'expo-router';

import { useTheme } from '../../context/AccessibilityContext';

export default function CaregiverLayout() {
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
      <Stack.Screen name="patient/[id]" options={{ title: 'Patient Records' }} />
      <Stack.Screen name="cognitive" options={{ title: 'Cognitive Status' }} />
      <Stack.Screen name="caregiver-reports" options={{ title: 'Reports & Risk Analysis' }} />
    </Stack>
  );
}
