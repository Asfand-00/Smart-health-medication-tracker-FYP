import { TabsLayout } from '../../../components/TabsLayout';

export default function DoctorTabs() {
  return (
    <TabsLayout
      tabs={[
        { name: 'dashboard', title: 'Dashboard', icon: 'speedometer-outline', headerTitle: 'Doctor Dashboard' },
        { name: 'doctor-patients', title: 'Patients', icon: 'people-outline', headerTitle: 'My Patients' },
        { name: 'doctor-prescriptions', title: 'Prescriptions', icon: 'document-attach-outline' },
        { name: 'approvals', title: 'Approvals', icon: 'checkmark-done-outline', headerTitle: 'Plan approvals' },
        { name: 'doctor-more', title: 'More', icon: 'grid-outline' },
      ]}
    />
  );
}
