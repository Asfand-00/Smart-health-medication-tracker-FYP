import { MoreMenu } from '../../../components/MoreMenu';

/** Caregiver features that are not bottom tabs. */
export default function CaregiverMore() {
  return (
    <MoreMenu
      sections={[
        {
          title: 'Clinical',
          items: [
            { title: 'AI insights', subtitle: 'Missed-dose predictions and risk flags per patient', icon: 'sparkles-outline', href: '/ai-insights' },
            { title: 'Prescriptions', subtitle: 'Upload and track doctor prescriptions', icon: 'document-attach-outline', href: '/prescriptions' },
            { title: 'Plan approvals', subtitle: 'Approve patient requests, propose changes', icon: 'checkmark-done-outline', href: '/plan-requests' },
            { title: 'Cognitive status', subtitle: 'Log and track assessments', icon: 'bulb-outline', href: '/cognitive' },
            { title: 'Treatment templates', subtitle: 'Apply common plans to a patient', icon: 'albums-outline', href: '/templates' },
          ],
        },
        {
          title: 'Analytics',
          items: [
            { title: 'Health analytics', subtitle: 'Vitals trends, performance, CSV/PDF', icon: 'analytics-outline', href: '/analytics' },
            { title: 'Medication calendar', subtitle: 'Month view per patient', icon: 'calendar-outline', href: '/calendar' },
            { title: 'Reports & risk', subtitle: 'Adherence analytics per patient', icon: 'bar-chart-outline', href: '/caregiver-reports' },
            { title: 'Reports hub', subtitle: 'Medication plans, risk factors, exports', icon: 'document-text-outline', href: '/reports' },
            { title: 'Drug information', subtitle: 'Reference and interaction checks', icon: 'book-outline', href: '/drug-info' },
          ],
        },
        {
          title: 'Support',
          items: [
            { title: 'Emergency support', subtitle: "Patients' trusted contacts", icon: 'shield-checkmark-outline', href: '/emergency-contacts' },
            { title: 'Notifications', subtitle: 'Alerts, delivery log and settings', icon: 'notifications-outline', href: '/notifications' },
          ],
        },
      ]}
    />
  );
}
