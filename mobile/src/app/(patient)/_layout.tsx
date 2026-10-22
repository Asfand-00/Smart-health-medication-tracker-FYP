import { Stack } from 'expo-router';

import { useTheme } from '../../context/AccessibilityContext';

/** Patient area: tab bar + pushed detail screens (web sidebar entries not in the tab bar). */
export default function PatientLayout() {
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
      <Stack.Screen name="medical-profile" options={{ title: 'Medical Profile' }} />
      <Stack.Screen name="care-team" options={{ title: 'My Care Team' }} />
      <Stack.Screen name="reminders" options={{ title: 'Caregiver Reminders' }} />
      <Stack.Screen name="adherence" options={{ title: 'My Adherence' }} />
      <Stack.Screen name="adherence-history" options={{ title: 'Compliance Logs' }} />
      <Stack.Screen name="mood" options={{ title: 'My Mood' }} />
    </Stack>
  );
}
