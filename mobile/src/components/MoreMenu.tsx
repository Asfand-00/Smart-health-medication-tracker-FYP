import { Ionicons } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import { View } from 'react-native';

import { useAuth, useCurrentUser } from '../context/AuthContext';
import { ROLE_LABEL, fullName, initials } from '../utils/format';
import { AccessibilityControls } from './AccessibilityControls';
import { AppText } from './ui/AppText';
import { Avatar, Card, Divider, ListItem, Pill, SectionHeader } from './ui/Card';
import { Screen, screenStyles } from './ui/Screen';
import { useTheme } from '../context/AccessibilityContext';
import { confirmAction } from '../utils/confirm';

export interface MenuEntry {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: Href;
}

/** "More" tab — every web sidebar entry that is not a bottom tab, plus account actions. */
export function MoreMenu({ sections }: { sections: { title: string; items: MenuEntry[] }[] }) {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  const signOut = async () => {
    if (await confirmAction('Sign out', 'Are you sure you want to sign out?', 'Sign out')) {
      await logout();
    }
  };

  return (
    <Screen>
      <Card>
        <View style={[screenStyles.row, { alignItems: 'center' }]}>
          <Avatar text={initials(user)} size={52} />
          <View style={screenStyles.flex}>
            <AppText variant="heading">{fullName(user)}</AppText>
            <AppText variant="caption" tone="faint">
              {user.email}
            </AppText>
          </View>
          <Pill label={ROLE_LABEL[user.role]} color={colors.purple} />
        </View>
      </Card>

      {sections.map((section) => (
        <View key={section.title} style={screenStyles.gap}>
          <SectionHeader title={section.title} />
          <Card>
            {section.items.map((item, i) => (
              <View key={item.title}>
                {i > 0 && <Divider />}
                <ListItem title={item.title} subtitle={item.subtitle} icon={item.icon} onPress={() => router.push(item.href)} />
              </View>
            ))}
          </Card>
        </View>
      ))}

      <SectionHeader title="Accessibility" />
      <AccessibilityControls compact />

      <SectionHeader title="Account" />
      <Card>
        <ListItem title="My profile" icon="person-outline" onPress={() => router.push('/profile')} />
        <Divider />
        <ListItem title="Settings" icon="settings-outline" onPress={() => router.push('/settings')} />
        <Divider />
        <ListItem title="Sign out" icon="log-out-outline" destructive onPress={signOut} />
      </Card>
    </Screen>
  );
}
