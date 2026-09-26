import { TabsLayout } from '../../../components/TabsLayout';

export default function PatientTabs() {
  return (
    <TabsLayout
      tabs={[
        { name: 'home', title: 'Home', icon: 'home-outline', headerTitle: 'Dashboard' },
        { name: 'today', title: 'Today', icon: 'alarm-outline', headerTitle: 'Smart Reminders' },
        { name: 'medications', title: 'Medications', icon: 'medkit-outline' },
        { name: 'vitals', title: 'Vitals', icon: 'pulse-outline', headerTitle: 'Health Vitals' },
        { name: 'patient-more', title: 'More', icon: 'grid-outline' },
      ]}
    />
  );
}
