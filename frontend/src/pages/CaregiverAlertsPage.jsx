import React, { useState, useEffect } from 'react';
import { FiCheck, FiAlertTriangle } from 'react-icons/fi';
import DashboardLayout from '../components/layout/DashboardLayout';
import { caregiverDashboardService } from '../api/caregiverDashboard.service';
import { notificationService } from '../api/notification.service';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/dashboard/caregiver',                icon: '🏠',       label: 'Overview' },
  { to: '/dashboard/caregiver/monitoring',     icon: '👁️',       label: 'Monitoring' },
  { to: '/dashboard/caregiver/notes',          icon: '📝',       label: 'Notes Log' },
  { to: '/dashboard/caregiver/alerts',         icon: '🚨',       label: 'Alerts Hub' },
  { to: '/dashboard/caregiver/reports',        icon: '📊',       label: 'Reports & Risk' }
];

const ALERT_ICONS = {
  missed_dose: { icon: '💊', bg: 'border-l-rose-500 bg-gradient-to-r from-rose-950/30 to-transparent' },
  escalation: { icon: '🚨', bg: 'border-l-red-500 bg-gradient-to-r from-red-950/30 to-transparent' },
  cognitive_alert: { icon: '🧠', bg: 'border-l-amber-500 bg-gradient-to-r from-amber-950/30 to-transparent' },
  behavioral_alert: { icon: '👁️', bg: 'border-l-purple-500 bg-gradient-to-r from-purple-950/30 to-transparent' },
};

export default function CaregiverAlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await caregiverDashboardService.getAlerts();
      if (res.success) {
        setAlerts(res.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load alerts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleDismiss = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setAlerts(prev => prev.filter(a => a._id !== id));
      toast.success('Alert dismissed.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to dismiss alert.');
    }
  };

  return (
    <DashboardLayout navItems={NAV_ITEMS} title="🚨 Alerts Hub">
      <div className="flex flex-col gap-6 max-w-4xl mx-auto select-none">

        {/* Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <FiAlertTriangle className="text-rose-400" /> Active Alerts
            </h2>
            <p className="text-xs md:text-sm text-slate-400">
              {alerts.length > 0
                ? `You have ${alerts.length} active alerts requiring your attention.`
                : 'No active alerts at this time.'}
            </p>
          </div>
          <button
            onClick={fetchAlerts}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Alerts List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="bg-slate-900/40 border-2 border-dashed border-slate-800 rounded-3xl p-16 text-center flex flex-col items-center gap-4">
            <div className="text-6xl">✅</div>
            <h3 className="text-xl font-bold text-white">All Clear</h3>
            <p className="text-xs md:text-sm text-slate-400 max-w-md">
              There are no active patient alerts. All patients are currently adhering to their schedules.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {alerts.map((alert) => {
              const cfg = ALERT_ICONS[alert.type] || ALERT_ICONS.missed_dose;
              const patientName = alert.fromUserId
                ? `${alert.fromUserId.firstName} ${alert.fromUserId.lastName}`
                : 'Unknown Patient';

              return (
                <div
                  key={alert._id}
                  className={`bg-slate-900 border border-slate-800 rounded-2xl p-5 border-l-4 ${cfg.bg} transition-all hover:shadow-xl flex flex-col md:flex-row md:items-center gap-4`}
                >
                  <div className="text-4xl flex-shrink-0">{cfg.icon}</div>

                  <div className="flex-1 flex flex-col gap-1.5">
                    <h4 className="text-base font-black text-white">{alert.title}</h4>
                    <p className="text-xs md:text-sm text-slate-300 font-medium">{alert.message}</p>
                    <div className="flex flex-wrap gap-3 mt-1 text-3xs font-semibold text-slate-500">
                      <span>Patient: <span className="text-slate-300">{patientName}</span></span>
                      <span>{new Date(alert.createdAt).toLocaleString()}</span>
                      <span className={`uppercase tracking-widest font-black ${
                        alert.priority === 'critical' ? 'text-rose-400 animate-pulse' : 'text-orange-400'
                      }`}>
                        {alert.priority}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDismiss(alert._id)}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer flex-shrink-0"
                  >
                    <FiCheck /> Dismiss
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
