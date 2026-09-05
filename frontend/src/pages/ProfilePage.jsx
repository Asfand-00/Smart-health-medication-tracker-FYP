/**
 * PROFILE PAGE — ProfilePage.jsx
 * =================================
 * Allows any logged-in user to view and update their profile.
 * Calls PUT /api/user/profile and updates the AuthContext.
 */

import { useState } from 'react';
import { FiUser, FiMail, FiPhone, FiSave, FiEdit2 } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/layout/DashboardLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import api from '../api/axios';
import toast from 'react-hot-toast';

import { FiHome, FiPlusCircle, FiCalendar, FiHeart, FiTrendingUp, FiBell, FiActivity, FiUsers } from 'react-icons/fi';

// Helper to get role-specific nav items so the sidebar doesn't disappear
const getNavItems = (role) => {
  if (role === 'patient') {
    return [
      { to: '/dashboard/patient',                  icon: FiHome,       label: 'Dashboard' },
      { to: '/dashboard/patient/medical-profile',  icon: FiHeart,      label: 'Medical Profile' },
      { to: '/medications',                        icon: FiPlusCircle, label: 'Medications' },
      { to: '/vitals',                             icon: FiActivity,   label: 'Health Vitals' },
      { to: '/dashboard/patient/care-team',        icon: FiUsers,      label: 'Care Team' },
      { to: '/schedule',                           icon: FiCalendar,   label: 'Schedule' },
      { to: '/reminders',                          icon: FiBell,       label: 'Reminders' },
      { to: '/progress',                           icon: FiTrendingUp, label: 'Progress' },
    ];
  }
  return [
    { to: `/dashboard/${role}`, icon: FiHome, label: 'Dashboard' }
  ];
};

const ROLE_COLORS = {
  patient:   'bg-blue-500/20 text-blue-300 border-blue-500/30',
  caregiver: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  doctor:    'bg-teal-500/20 text-teal-300 border-teal-500/30',
  admin:     'bg-red-500/20 text-red-300 border-red-500/30',
};

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing]   = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [formData, setFormData]     = useState({
    firstName: user?.firstName || '',
    lastName:  user?.lastName  || '',
    phone:     user?.phone     || '',
    gender:    user?.gender    || '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.put('/user/profile', formData);
      updateUser(data.data.user);        // Update context + localStorage
      toast.success('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    setFormData({
      firstName: user?.firstName || '',
      lastName:  user?.lastName  || '',
      phone:     user?.phone     || '',
      gender:    user?.gender    || '',
    });
    setIsEditing(false);
  };

  return (
    <DashboardLayout navItems={getNavItems(user?.role)} title="My Profile">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Profile Header Card */}
        <div className="glass-card p-8 text-center">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-600 to-teal-500
                          flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 shadow-lg">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>

          <h2 className="text-2xl font-bold text-white">
            {user?.firstName} {user?.lastName}
          </h2>
          <p className="text-white/40 text-sm mt-1">{user?.email}</p>

          {/* Role badge */}
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border mt-3 ${ROLE_COLORS[user?.role]}`}>
            {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
          </span>

          {/* Account info pills */}
          <div className="flex justify-center gap-4 mt-5">
            <div className="glass-card px-4 py-2 text-center">
              <div className="text-white font-semibold text-sm">
                {user?.isEmailVerified ? '✓ Verified' : 'Unverified'}
              </div>
              <div className="text-white/30 text-xs">Email Status</div>
            </div>
            <div className="glass-card px-4 py-2 text-center">
              <div className="text-white font-semibold text-sm">
                {user?.isActive ? 'Active' : 'Inactive'}
              </div>
              <div className="text-white/30 text-xs">Account Status</div>
            </div>
            <div className="glass-card px-4 py-2 text-center">
              <div className="text-white font-semibold text-sm">
                {new Date(user?.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </div>
              <div className="text-white/30 text-xs">Member Since</div>
            </div>
          </div>
        </div>

        {/* Editable Profile Form */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-semibold">Personal Information</h3>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
              >
                <FiEdit2 className="w-3.5 h-3.5" /> Edit Profile
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="firstName" name="firstName" label="First Name"
                icon={FiUser} value={formData.firstName}
                onChange={handleChange} disabled={!isEditing}
                className={!isEditing ? 'opacity-60' : ''}
              />
              <Input
                id="lastName" name="lastName" label="Last Name"
                icon={FiUser} value={formData.lastName}
                onChange={handleChange} disabled={!isEditing}
                className={!isEditing ? 'opacity-60' : ''}
              />
            </div>

            {/* Email — read-only (security: email change needs verification) */}
            <Input
              id="email" name="email" type="email" label="Email Address"
              icon={FiMail} value={user?.email || ''}
              disabled className="opacity-60"
            />
            <p className="text-white/30 text-xs -mt-2 ml-1">Email cannot be changed from here for security reasons.</p>

            <Input
              id="phone" name="phone" type="tel" label="Phone Number"
              icon={FiPhone} value={formData.phone}
              placeholder="+92 300 0000000"
              onChange={handleChange} disabled={!isEditing}
              className={!isEditing ? 'opacity-60' : ''}
            />

            {/* Gender select */}
            <div>
              <label className="input-label">Gender</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                disabled={!isEditing}
                className={`input-field ${!isEditing ? 'opacity-60' : ''}`}
              >
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Action buttons (visible only when editing) */}
            {isEditing && (
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={handleCancel} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  isLoading={isLoading}
                  className="flex-1"
                >
                  <FiSave className="w-4 h-4" />
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProfilePage;
