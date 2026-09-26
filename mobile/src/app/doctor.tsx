/**
 * Doctor dashboard.
 *
 * The web DoctorDashboard.jsx renders hard-coded numbers and four invented
 * patients ("Ahmed Khan", "Sara Malik", ...) — none of it comes from the API.
 * The backend has no endpoint that lists a doctor's patients (User.assignedDoctor
 * exists in the schema but nothing reads or writes it), so there is no real
 * data to show. Rather than copy the fake data, this screen says so.
 */
import { Stack, useRouter } from 'expo-router';

import { HeaderActions } from '../components/HeaderActions';
import { AppText } from '../components/ui/AppText';
import { Card, Divider, ListItem } from '../components/ui/Card';
import { Screen } from '../components/ui/Screen';
import { useAuth, useCurrentUser } from '../context/AuthContext';
import { confirmAction } from '../utils/confirm';

export default function DoctorScreen() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const router = useRouter();

  return (
    <Screen>
      <Stack.Screen options={{ headerRight: () => <HeaderActions /> }} />
      <Card>
        <AppText variant="title">
          Dr. {user.firstName} {user.lastName}
        </AppText>
        <AppText tone="muted">Welcome to MedTracker.</AppText>
      </Card>

      <Card>
        <AppText variant="heading">Patient list not available yet</AppText>
        <AppText tone="muted">
          The server does not yet link doctors to patients, so there is no patient list, appointment count or prescription count to
          show. The web dashboard displays placeholder figures for these; this app only shows real data.
        </AppText>
        <AppText variant="caption" tone="faint">
          Notifications sent to your account still appear under the bell icon.
        </AppText>
      </Card>

      <Card>
        <ListItem title="Notifications" icon="notifications-outline" onPress={() => router.push('/notifications')} />
        <Divider />
        <ListItem title="My profile" icon="person-outline" onPress={() => router.push('/profile')} />
        <Divider />
        <ListItem title="Settings & accessibility" icon="settings-outline" onPress={() => router.push('/settings')} />
        <Divider />
        <ListItem
          title="Sign out"
          icon="log-out-outline"
          destructive
          onPress={async () => {
            if (await confirmAction('Sign out', 'Are you sure you want to sign out?', 'Sign out')) await logout();
          }}
        />
      </Card>
    </Screen>
  );
}
