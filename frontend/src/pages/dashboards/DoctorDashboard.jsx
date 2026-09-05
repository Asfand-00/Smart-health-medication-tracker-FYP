/**
 * DOCTOR DASHBOARD — DoctorDashboard.jsx
 * =========================================
 * Only accessible to users with role = "doctor".
 */

import { FiHome, FiUsers, FiCalendar, FiClipboard, FiActivity, FiBarChart2 } from 'react-icons/fi';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard/doctor', icon: FiHome,      label: 'Dashboard' },
  { to: '/my-patients',      icon: FiUsers,     label: 'My Patients', badge: 12 },
  { to: '/appointments',     icon: FiCalendar,  label: 'Appointments' },
  { to: '/prescriptions',    icon: FiClipboard, label: 'Prescriptions' },
  { to: '/analytics',        icon: FiBarChart2, label: 'Analytics' },
];

const STATS = [
  { label: 'Active Patients', value: '28',   sub: '+3 this week',     color: 'from-blue-600 to-blue-400',   icon: FiUsers },
  { label: "Today's Appointments", value: '6', sub: '2 completed',    color: 'from-teal-600 to-teal-400',   icon: FiCalendar },
  { label: 'Prescriptions Issued', value: '142', sub: 'This month',   color: 'from-purple-600 to-purple-400', icon: FiClipboard },
  { label: 'Adherence Avg',  value: '83%',  sub: 'Across all patients', color: 'from-rose-600 to-rose-400',  icon: FiActivity },
];

const PATIENTS = [
  { name: 'Ahmed Khan',    condition: 'Diabetes Type 2',   adherence: 87, lastSeen: '2 days ago' },
  { name: 'Sara Malik',   condition: 'Hypertension',       adherence: 92, lastSeen: 'Today' },
  { name: 'Bilal Raza',   condition: 'Asthma',             adherence: 65, lastSeen: '1 week ago' },
  { name: 'Fatima Sheikh', condition: 'High Cholesterol',  adherence: 78, lastSeen: '3 days ago' },
];

const DoctorDashboard = () => {
  const { user } = useAuth();

  return (
    <DashboardLayout navItems={NAV_ITEMS} title="Doctor Dashboard">

      {/* Header */}
      <div className="glass-card p-6 mb-6 bg-gradient-to-r from-teal-600/20 to-blue-600/10 border-teal-500/20">
        <h2 className="text-2xl font-bold text-white">Dr. {user?.firstName} {user?.lastName}</h2>
        <p className="text-white/50 mt-1">You have <span className="text-teal-400 font-semibold">4 appointments</span> remaining today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {STATS.map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="stat-card">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-white/60 text-sm">{stat.label}</div>
              <div className="text-white/30 text-xs mt-1">{stat.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Patient List */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <FiUsers className="w-4 h-4 text-teal-400" /> Recent Patients
          </h3>
          <button className="text-teal-400 text-xs hover:text-teal-300">View All →</button>
        </div>
        <div className="space-y-3">
          {PATIENTS.map(patient => (
            <div key={patient.name} className="flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-600 to-blue-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {patient.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium">{patient.name}</div>
                <div className="text-white/30 text-xs">{patient.condition}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`text-sm font-semibold ${patient.adherence >= 80 ? 'text-teal-400' : 'text-yellow-400'}`}>
                  {patient.adherence}%
                </div>
                <div className="text-white/30 text-xs">adherence</div>
              </div>
              <div className="text-white/30 text-xs hidden sm:block flex-shrink-0">{patient.lastSeen}</div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DoctorDashboard;
