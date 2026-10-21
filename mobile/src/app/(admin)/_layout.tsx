import { Stack } from 'expo-router';

import { useTheme } from '../../context/AccessibilityContext';

export default function AdminLayout() {
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
      <Stack.Screen name="audit" options={{ title: 'Access logs & audit trail' }} />
      <Stack.Screen name="user/[id]" options={{ title: 'User' }} />
    </Stack>
  );
}
