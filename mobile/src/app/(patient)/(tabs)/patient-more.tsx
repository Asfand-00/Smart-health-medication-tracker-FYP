import { MoreMenu } from '../../../components/MoreMenu';

/** Patient features that are not bottom tabs. */
export default function PatientMore() {
  return (
    <MoreMenu
      sections={[
        {
          title: 'My health',
          items: [
            { title: 'Medical profile', subtitle: 'Blood group, history, conditions, emergency contact', icon: 'heart-outline', href: '/medical-profile' },
            { title: 'Prescriptions', subtitle: 'Upload, verify and apply doctor prescriptions', icon: 'document-attach-outline', href: '/prescriptions' },
            { title: 'Medication calendar', subtitle: 'Month view of scheduled and taken doses', icon: 'calendar-outline', href: '/calendar' },
            { title: 'My adherence', subtitle: "Today's and weekly compliance", icon: 'bar-chart-outline', href: '/adherence' },
            { title: 'Compliance logs', subtitle: 'Search every recorded dose', icon: 'list-outline', href: '/adherence-history' },
            { title: 'Mood check', subtitle: 'Log how you feel', icon: 'happy-outline', href: '/mood' },
          ],
        },
        {
          title: 'Insights & reports',
          items: [
            { title: 'AI insights', subtitle: 'Missed-dose predictions, risks, recommendations', icon: 'sparkles-outline', href: '/ai-insights' },
            { title: 'Health analytics', subtitle: 'Vitals trends, performance over time, exports', icon: 'analytics-outline', href: '/analytics' },
            { title: 'Reports hub', subtitle: 'Adherence, risk and PDF/CSV exports', icon: 'document-text-outline', href: '/reports' },
            { title: 'Drug information', subtitle: 'Medicine reference and interaction check', icon: 'book-outline', href: '/drug-info' },
          ],
        },
        {
          title: 'Care & support',
          items: [
            { title: 'Care team', subtitle: 'Your caregivers, doctors and requests', icon: 'people-outline', href: '/care-team' },
            { title: 'Plan approvals', subtitle: 'Propose medication changes to your care team', icon: 'checkmark-done-outline', href: '/plan-requests' },
            { title: 'Treatment templates', subtitle: 'Common plans you can apply in one tap', icon: 'albums-outline', href: '/templates' },
            { title: 'Caregiver reminders', subtitle: 'Messages and pokes from your caregiver', icon: 'chatbubbles-outline', href: '/reminders' },
            { title: 'Emergency support', subtitle: 'Trusted contacts — tap to call', icon: 'shield-checkmark-outline', href: '/emergency-contacts' },
            { title: 'Notifications', subtitle: 'Alerts, delivery log and settings', icon: 'notifications-outline', href: '/notifications' },
          ],
        },
      ]}
    />
  );
}
