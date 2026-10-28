import { MoreMenu } from '../../../components/MoreMenu';

export default function DoctorMore() {
  return (
    <MoreMenu
      sections={[
        {
          title: 'Clinical tools',
          items: [
            { title: 'AI insights & predictions', subtitle: 'Missed-dose risk and behaviour patterns per patient', icon: 'sparkles-outline', href: '/ai-insights' },
            { title: 'Health analytics', subtitle: 'Vitals trends, adherence over time, reports', icon: 'analytics-outline', href: '/analytics' },
            { title: 'Medication calendar', subtitle: 'Month view of scheduled vs taken doses', icon: 'calendar-outline', href: '/calendar' },
            { title: 'Drug information', subtitle: 'Reference and interaction checks', icon: 'book-outline', href: '/drug-info' },
            { title: 'Treatment templates', subtitle: 'Apply common plans to a patient', icon: 'albums-outline', href: '/templates' },
          ],
        },
        {
          title: 'Inbox',
          items: [{ title: 'Notifications', subtitle: 'Alerts and system messages', icon: 'notifications-outline', href: '/notifications' }],
        },
      ]}
    />
  );
}
