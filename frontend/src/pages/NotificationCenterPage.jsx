import React, { useState, useEffect } from 'react';
import { FiTrash2, FiCheck, FiFilter } from 'react-icons/fi';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useNotifications } from '../context/NotificationContext';
import AccessibilityToggle from '../components/ui/AccessibilityToggle';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function NotificationCenterPage() {
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    fetchNotifications,
    loading
  } = useNotifications();

  // Navigation config based on role
  const navItems = user?.role === 'patient' 
    ? [
        { to: '/dashboard/patient',                  icon: '🏠',       label: 'Dashboard' },
        { to: '/smart-reminders',                    icon: '⏰',       label: 'Smart Reminders' },
        { to: '/adherence',                          icon: '📊',       label: 'My Adherence' },
        { to: '/mood',                               icon: '💖',       label: 'My Mood' },
        { to: '/medications',                        icon: '💊',       label: 'Medications' },
        { to: '/vitals',                             icon: '❤️',       label: 'Health Vitals' }
      ]
    : [
        { to: '/dashboard/caregiver',                icon: '🏠',       label: 'Overview' },
        { to: '/dashboard/caregiver/monitoring',     icon: '👁️',       label: 'Monitoring' },
        { to: '/dashboard/caregiver/notes',          icon: '📝',       label: 'Notes Log' },
        { to: '/dashboard/caregiver/alerts',         icon: '🚨',       label: 'Alerts Hub' },
        { to: '/dashboard/caregiver/reports',        icon: '📊',       label: 'Reports & Risk' }
      ];

  const [filterType, setFilterType] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  const handleFetchFiltered = () => {
    fetchNotifications({
      type: filterType || undefined,
      priority: filterPriority || undefined
    });
  };

  useEffect(() => {
    handleFetchFiltered();
  }, [filterType, filterPriority]);

  return (
    <DashboardLayout navItems={navItems} title="🔔 Notification Center">
      <div className="flex flex-col gap-6 max-w-4xl mx-auto select-none">
        {user?.role === 'patient' && <AccessibilityToggle />}

        {/* Header Summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <span>🔔</span> Notification Inbox
            </h2>
            <p className="text-xs md:text-sm text-slate-400">
              {unreadCount > 0 
                ? `You have ${unreadCount} unread system logs and reminders.`
                : 'All caught up! No unread notifications.'}
            </p>
          </div>
          {notifications.length > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              <FiCheck /> Mark All Read
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-wrap gap-4 items-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <FiFilter /> Filter:
          </span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-800 border border-slate-700/80 rounded-xl p-2 text-slate-200 text-xs focus:outline-none"
          >
            <option value="">All Event Types</option>
            <option value="reminder">Reminders</option>
            <option value="missed_dose">Missed Doses</option>
            <option value="escalation">Escalations</option>
            <option value="cognitive_alert">Cognitive Decline</option>
            <option value="behavioral_alert">Behavioral Concerns</option>
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="bg-slate-800 border border-slate-700/80 rounded-xl p-2 text-slate-200 text-xs focus:outline-none"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        {/* Notifications Listing */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-slate-900/40 border border-dashed border-slate-850 rounded-3xl p-16 text-center text-slate-500 text-sm">
            No notifications match your current selection.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {notifications.map((n) => {
              const borderStyles = 
                n.priority === 'critical' ? 'border-rose-500' :
                n.priority === 'high' ? 'border-orange-500' :
                n.isRead ? 'border-slate-850' : 'border-blue-500';

              return (
                <div 
                  key={n._id}
                  className={`bg-slate-900/90 border rounded-2xl p-5 flex flex-col gap-2 transition-all hover:bg-slate-900 ${borderStyles}`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex flex-col gap-0.5">
                      <h4 className={`text-base font-bold ${n.isRead ? 'text-slate-400' : 'text-white'}`}>
                        {n.title}
                      </h4>
                      <span className="text-3xs font-semibold text-slate-500 uppercase tracking-widest">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {!n.isRead && (
                        <button
                          onClick={() => markAsRead(n._id)}
                          className="p-2 bg-blue-900/20 hover:bg-blue-900/40 text-blue-400 rounded-xl transition cursor-pointer"
                          title="Mark Read"
                        >
                          <FiCheck className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(n._id)}
                        className="p-2 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-xl transition cursor-pointer"
                        title="Delete"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs md:text-sm text-slate-300 font-medium">
                    {n.message}
                  </p>

                  {n.priority !== 'normal' && (
                    <div className="flex mt-1">
                      <span className={`px-2 py-0.5 rounded text-4xs font-extrabold uppercase tracking-widest border ${
                        n.priority === 'critical' 
                          ? 'bg-rose-950/40 text-rose-400 border-rose-900'
                          : 'bg-orange-950/40 text-orange-400 border-orange-900'
                      }`}>
                        {n.priority} Priority
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
