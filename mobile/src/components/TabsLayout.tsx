import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../context/AccessibilityContext';
import { HeaderActions } from './HeaderActions';

export interface TabDef {
  name: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  headerTitle?: string;
}

/**
 * Bottom tab bar — the mobile replacement for the web sidebar. The most used
 * pages become tabs; the rest live under the "More" tab.
 */
export function TabsLayout({ tabs }: { tabs: TabDef[] }) {
  const theme = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const active = theme.highContrast ? '#ffff00' : colors.primary;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700', fontSize: theme.fs(17) },
        headerRight: () => <HeaderActions />,
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: Math.min(theme.fs(11), 13), fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: theme.borderWidth,
          minHeight: 58 + (Platform.OS === 'ios' ? insets.bottom : 0),
          paddingTop: 4,
        },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            headerTitle: t.headerTitle ?? t.title,
            tabBarAccessibilityLabel: t.title,
            tabBarIcon: ({ color, size }) => <Ionicons name={t.icon} color={color} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
