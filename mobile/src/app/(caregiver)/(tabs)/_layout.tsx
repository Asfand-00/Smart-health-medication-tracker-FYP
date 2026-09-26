import { TabsLayout } from '../../../components/TabsLayout';

export default function CaregiverTabs() {
  return (
    <TabsLayout
      tabs={[
        { name: 'patients', title: 'Overview', icon: 'people-outline', headerTitle: 'Caregiver Dashboard' },
        { name: 'monitoring', title: 'Monitoring', icon: 'eye-outline', headerTitle: 'Patient Monitoring' },
        { name: 'alerts', title: 'Alerts', icon: 'warning-outline', headerTitle: 'Alerts Hub' },
        { name: 'notes', title: 'Notes', icon: 'create-outline', headerTitle: 'Caregiver Notes' },
        { name: 'caregiver-more', title: 'More', icon: 'grid-outline' },
      ]}
    />
  );
}
