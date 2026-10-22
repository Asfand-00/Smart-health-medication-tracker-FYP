import { TabsLayout } from '../../../components/TabsLayout';

export default function AdminTabs() {
  return (
    <TabsLayout
      tabs={[
        { name: 'monitor', title: 'Monitor', icon: 'speedometer-outline', headerTitle: 'System monitoring' },
        { name: 'users', title: 'Users', icon: 'people-outline', headerTitle: 'Users & roles' },
        { name: 'admin-alerts', title: 'Alerts', icon: 'megaphone-outline', headerTitle: 'Notifications & alerts' },
        { name: 'admin-reports', title: 'Reports', icon: 'bar-chart-outline', headerTitle: 'Administrative reports' },
        { name: 'config', title: 'Config', icon: 'settings-outline', headerTitle: 'Platform configuration' },
      ]}
    />
  );
}
