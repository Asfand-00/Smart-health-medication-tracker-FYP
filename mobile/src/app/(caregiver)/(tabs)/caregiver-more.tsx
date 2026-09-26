import { MoreMenu } from '../../../components/MoreMenu';

/** Remaining caregiver sidebar entries from the web NAV_ITEMS. */
export default function CaregiverMore() {
  return (
    <MoreMenu
      sections={[
        {
          title: 'Clinical',
          items: [
            { title: 'Cognitive status', subtitle: 'Log and track assessments', icon: 'bulb-outline', href: '/cognitive' },
            { title: 'Reports & risk', subtitle: 'Adherence analytics per patient', icon: 'analytics-outline', href: '/caregiver-reports' },
            { title: 'Reports hub', subtitle: 'Medication plans, risk factors, exports', icon: 'document-text-outline', href: '/reports' },
          ],
        },
        {
          title: 'Support',
          items: [
            { title: 'Emergency support', subtitle: "Patients' trusted contacts", icon: 'shield-checkmark-outline', href: '/emergency-contacts' },
            { title: 'Notifications', subtitle: 'Alerts and system messages', icon: 'notifications-outline', href: '/notifications' },
          ],
        },
      ]}
    />
  );
}
