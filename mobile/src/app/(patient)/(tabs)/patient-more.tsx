import { MoreMenu } from '../../../components/MoreMenu';

/** Remaining patient sidebar entries from the web DashboardLayout NAV_ITEMS. */
export default function PatientMore() {
  return (
    <MoreMenu
      sections={[
        {
          title: 'My health',
          items: [
            { title: 'Medical profile', subtitle: 'Blood group, history, emergency contact', icon: 'heart-outline', href: '/medical-profile' },
            { title: 'My adherence', subtitle: "Today's and weekly compliance", icon: 'bar-chart-outline', href: '/adherence' },
            { title: 'Compliance logs', subtitle: 'Search every recorded dose', icon: 'list-outline', href: '/adherence-history' },
            { title: 'Mood check', subtitle: 'Log how you feel', icon: 'happy-outline', href: '/mood' },
            { title: 'Reports hub', subtitle: 'Adherence, risk and exports', icon: 'document-text-outline', href: '/reports' },
          ],
        },
        {
          title: 'Care & support',
          items: [
            { title: 'Care team', subtitle: 'Your caregivers and requests', icon: 'people-outline', href: '/care-team' },
            { title: 'Caregiver reminders', subtitle: 'Messages and pokes from your caregiver', icon: 'chatbubbles-outline', href: '/reminders' },
            { title: 'Emergency support', subtitle: 'Trusted contacts — tap to call', icon: 'shield-checkmark-outline', href: '/emergency-contacts' },
            { title: 'Notifications', subtitle: 'Alerts and system messages', icon: 'notifications-outline', href: '/notifications' },
          ],
        },
      ]}
    />
  );
}
