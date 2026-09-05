/**
 * REMINDERS PAGE — RemindersPage.jsx
 * =====================================
 * Patient's inbox for all reminders from caregivers.
 * Alzheimer-friendly: large text, clear icons, simple layout.
 * Shows real-time notifications (via SocketContext toast) and 
 * persists them in the list from the database.
 */

import { useState, useEffect } from 'react';
import {
  FiHome, FiHeart, FiPlusCircle, FiActivity, FiUsers,
  FiBell, FiCheck, FiClock, FiAlertCircle, FiRefreshCw
} from 'react-icons/fi';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { reminderService } from '../../api/reminder.service';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/dashboard/patient',                  icon: FiHome,       label: 'Dashboard' },
  { to: '/dashboard/patient/medical-profile',  icon: FiHeart,      label: 'Medical Profile' },
  { to: '/medications',                        icon: FiPlusCircle, label: 'Medications' },
  { to: '/vitals',                             icon: FiActivity,   label: 'Health Vitals' },
  { to: '/dashboard/patient/care-team',        icon: FiUsers,      label: 'Care Team' },
  { to: '/reminders',                          icon: FiBell,       label: 'Reminders' },
];

// Icon and color per reminder type
const TYPE_CONFIG = {
  medication:  { icon: '💊', color: 'border-l-blue-500',   bg: 'from-blue-900/30 to-transparent' },
  appointment: { icon: '🩺', color: 'border-l-purple-500', bg: 'from-purple-900/30 to-transparent' },
  exercise:    { icon: '🏃', color: 'border-l-green-500',  bg: 'from-green-900/30 to-transparent' },
  meal:        { icon: '🍽️', color: 'border-l-yellow-500', bg: 'from-yellow-900/30 to-transparent' },
  poke:        { icon: '👋', color: 'border-l-orange-500', bg: 'from-orange-900/30 to-transparent' },
  general:     { icon: '🔔', color: 'border-l-teal-500',   bg: 'from-teal-900/30 to-transparent' },
};

const RemindersPage = () => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading]     = useState(true);

  const fetchReminders = async () => {
    setLoading(true);
    try {
      const res = await reminderService.getMyReminders();
      setReminders(res.data || []);
    } catch {
      toast.error('Failed to load reminders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  const handleMarkRead = async (id) => {
    try {
      await reminderService.markAsRead(id);
      setReminders(prev =>
        prev.map(r => r._id === id ? { ...r, isRead: true } : r)
      );
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const unreadCount = reminders.filter(r => !r.isRead).length;

  return (
    <DashboardLayout navItems={NAV_ITEMS} title="Reminders">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="glass-card p-6 border-l-4 border-l-teal-500 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <FiBell className="w-7 h-7 text-teal-400" /> Your Reminders
            </h2>
            <p className="text-white/50 text-sm mt-1">
              {unreadCount > 0
                ? <span className="text-orange-400 font-medium">{unreadCount} unread reminder{unreadCount > 1 ? 's' : ''}</span>
                : 'All caught up! No unread reminders.'}
            </p>
          </div>
          <button
            onClick={fetchReminders}
            className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            title="Refresh"
          >
            <FiRefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Reminder List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400" />
          </div>
        ) : reminders.length === 0 ? (
          <div className="glass-card p-16 text-center border-dashed border-white/10">
            <div className="text-6xl mb-4">🔔</div>
            <h3 className="text-xl font-medium text-white mb-2">No Reminders Yet</h3>
            <p className="text-white/40">Your caregiver's reminders will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reminders.map(reminder => {
              const config = TYPE_CONFIG[reminder.reminderType] || TYPE_CONFIG.general;
              return (
                <div
                  key={reminder._id}
                  className={`glass-card p-5 border-l-4 ${config.color} bg-gradient-to-r ${config.bg} transition-all ${!reminder.isRead ? 'ring-1 ring-white/10' : 'opacity-70'}`}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-3xl mt-1 shrink-0">{config.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-white font-semibold text-lg leading-snug">{reminder.title}</h4>
                        {!reminder.isRead && (
                          <span className="shrink-0 px-2 py-0.5 bg-teal-500/20 text-teal-300 rounded-full text-xs font-medium">New</span>
                        )}
                      </div>
                      {reminder.message && (
                        <p className="text-white/60 text-base mt-1">{reminder.message}</p>
                      )}
                      <div className="flex items-center gap-4 mt-3 flex-wrap">
                        <span className="text-white/30 text-xs flex items-center gap-1">
                          <FiClock className="w-3.5 h-3.5" />
                          {new Date(reminder.createdAt).toLocaleString()}
                        </span>
                        {reminder.createdBy && (
                          <span className="text-white/30 text-xs flex items-center gap-1">
                            <FiAlertCircle className="w-3.5 h-3.5" />
                            From: {reminder.createdBy.firstName} {reminder.createdBy.lastName}
                          </span>
                        )}
                      </div>
                    </div>
                    {!reminder.isRead && (
                      <button
                        onClick={() => handleMarkRead(reminder._id)}
                        className="shrink-0 p-2 rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 transition-colors"
                        title="Mark as Read"
                      >
                        <FiCheck className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default RemindersPage;
