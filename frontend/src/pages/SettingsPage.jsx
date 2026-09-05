/**
 * SETTINGS PAGE — SettingsPage.jsx
 * ==================================
 * Allows any logged-in user to update account settings
 * like password, recovery email, and notification preferences.
 */

import { useState } from 'react';
import { FiLock, FiMail, FiBell, FiShield, FiHome, FiPlusCircle, FiCalendar, FiHeart, FiTrendingUp } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/layout/DashboardLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';

// Helper to get role-specific nav items so the sidebar doesn't disappear
const getNavItems = (role) => {
  if (role === 'patient') {
    return [
      { to: '/dashboard/patient', icon: FiHome, label: 'Dashboard' },
      { to: '/dashboard/patient/medical-profile', icon: FiHeart, label: 'Medical Profile' },
      { to: '/medications', icon: FiPlusCircle, label: 'Medications' },
      { to: '/schedule', icon: FiCalendar, label: 'Schedule' },
      { to: '/reminders', icon: FiBell, label: 'Reminders' },
      { to: '/progress', icon: FiTrendingUp, label: 'Progress' },
    ];
  }
  return [
    { to: `/dashboard/${role}`, icon: FiHome, label: 'Dashboard' }
  ];
};

const SettingsPage = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Separate forms for separate sections
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [recoveryForm, setRecoveryForm] = useState({
    recoveryEmail: user?.recoveryEmail || '',
  });

  const handlePasswordChange = (e) => {
    setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });
  };

  const handleRecoveryChange = (e) => {
    setRecoveryForm({ ...recoveryForm, [e.target.name]: e.target.value });
  };

  const handleSavePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return toast.error("New passwords do not match.");
    }
    
    setIsLoading(true);
    try {
      // In a real app, this would hit an API endpoint like PUT /api/user/password
      // await api.put('/user/password', passwordForm);
      
      // Simulating network request for this module
      await new Promise(res => setTimeout(res, 1000));
      
      toast.success("Password updated successfully!");
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast.error("Failed to update password.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRecovery = async () => {
    setIsLoading(true);
    try {
      // Simulated endpoint: await api.put('/user/recovery', recoveryForm);
      await new Promise(res => setTimeout(res, 800));
      toast.success("Recovery options updated.");
    } catch (error) {
      toast.error("Failed to update recovery options.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout navItems={getNavItems(user?.role)} title="Settings">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Security / Password Section */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
              <FiLock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Change Password</h3>
              <p className="text-white/40 text-sm">Update your password to keep your account secure.</p>
            </div>
          </div>

          <div className="space-y-4 max-w-md">
            <Input
              id="currentPassword" name="currentPassword" type="password" label="Current Password"
              value={passwordForm.currentPassword} onChange={handlePasswordChange}
            />
            <Input
              id="newPassword" name="newPassword" type="password" label="New Password"
              value={passwordForm.newPassword} onChange={handlePasswordChange}
            />
            <Input
              id="confirmPassword" name="confirmPassword" type="password" label="Confirm New Password"
              value={passwordForm.confirmPassword} onChange={handlePasswordChange}
            />
            <Button onClick={handleSavePassword} isLoading={isLoading} className="w-full mt-2">
              Update Password
            </Button>
          </div>
        </div>

        {/* Account Recovery Section */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
            <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
              <FiShield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Account Recovery</h3>
              <p className="text-white/40 text-sm">Set up a backup email in case you lose access.</p>
            </div>
          </div>

          <div className="space-y-4 max-w-md">
            <Input
              id="recoveryEmail" name="recoveryEmail" type="email" label="Recovery Email Address"
              icon={FiMail} value={recoveryForm.recoveryEmail} onChange={handleRecoveryChange}
              placeholder="backup@example.com"
            />
            <Button variant="secondary" onClick={handleSaveRecovery} isLoading={isLoading} className="w-full mt-2">
              Save Recovery Info
            </Button>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
