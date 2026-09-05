/**
 * PATIENT DASHBOARD — PatientDashboard.jsx
 * ==========================================
 * Enhanced with:
 * - Daily vitals modal (shown once per day on login)
 * - Medication completion stats (taken % vs missed %)
 * - Quick actions for today's schedule
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FiHome, FiActivity, FiCalendar, FiHeart,
  FiPlusCircle, FiClock, FiBell, FiTrendingUp, FiUsers, FiCheck, FiX, FiSmile, FiShield, FiBarChart2
} from 'react-icons/fi';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DailyVitalsModal from '../../components/ui/DailyVitalsModal';
import { useAuth } from '../../context/AuthContext';
import { medicationService } from '../../api/medication.service';
import { vitalsService } from '../../api/vitals.service';
import { useSocket } from '../../context/SocketContext';

const NAV_ITEMS = [
  { to: '/dashboard/patient',                  icon: FiHome,       label: 'Dashboard' },
  { to: '/dashboard/patient/medical-profile',  icon: FiHeart,      label: 'Medical Profile' },
  { to: '/medications',                        icon: FiPlusCircle, label: 'Medications' },
  { to: '/vitals',                             icon: FiActivity,   label: 'Health Vitals' },
  { to: '/dashboard/patient/care-team',        icon: FiUsers,      label: 'Care Team' },
  { to: '/smart-reminders',                    icon: FiBell,       label: 'Smart Reminders' },
  { to: '/adherence',                          icon: FiBarChart2,  label: 'My Adherence' },
  { to: '/mood',                               icon: FiSmile,      label: 'Mood Check' },
  { to: '/emergency-contacts',                 icon: FiShield,     label: 'Emergency Support' },
  { to: '/reports',                            icon: FiTrendingUp, label: 'Reports Hub' }
];

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
};

// Circular progress ring
const ProgressRing = ({ percent, color, size = 80, stroke = 8 }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  );
};

const PatientDashboard = () => {
  const { user } = useAuth();
  const [medications, setMedications]       = useState([]);
  const [latestVitals, setLatestVitals]     = useState(null);
  const [medStats, setMedStats]             = useState(null);
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [isLoading, setIsLoading]           = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [medsRes, vitalsRes, statsRes, todayCheck] = await Promise.allSettled([
        medicationService.getAll(),
        vitalsService.getLatest(),
        medicationService.getStats(),
        vitalsService.checkToday(),
      ]);

      if (medsRes.status === 'fulfilled')   setMedications(medsRes.value.data || []);
      if (vitalsRes.status === 'fulfilled') setLatestVitals(vitalsRes.value.data);
      if (statsRes.status === 'fulfilled')  setMedStats(statsRes.value.data);

      // Show daily vitals modal if not logged today
      if (todayCheck.status === 'fulfilled' && !todayCheck.value.hasLoggedToday) {
        setShowVitalsModal(true);
      }
    } catch (_) {
      // silently fall back
    } finally {
      setIsLoading(false);
    }
  };

  const { socket } = useSocket();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (!socket) return;
    
    const handleUpdate = () => fetchDashboardData();
    
    // When caregiver logs or updates medication, refresh dashboard automatically
    socket.on('medication_logged', handleUpdate);
    socket.on('medication_updated', handleUpdate);
    // When a dose is confirmed via Smart Reminders, refresh stats
    socket.on('adherence_update', handleUpdate);

    return () => {
      socket.off('medication_logged', handleUpdate);
      socket.off('medication_updated', handleUpdate);
      socket.off('adherence_update', handleUpdate);
    };
  }, [socket]);

  const bpStr = latestVitals?.bloodPressure?.systolic
    ? `${latestVitals.bloodPressure.systolic}/${latestVitals.bloodPressure.diastolic}`
    : 'None';

  const todayTakenPct  = medStats?.today?.takenPercent  ?? 0;
  const overallTakenPct = medStats?.overall?.takenPercent ?? 0;

  // Calendar filter for medications
  const [selectedDateStr, setSelectedDateStr] = useState(new Date().toISOString().split('T')[0]);

  const filteredMedications = medications.filter(m => {
    const selDate = new Date(selectedDateStr);
    selDate.setHours(0,0,0,0);
    const startDate = new Date(m.startDate);
    startDate.setHours(0,0,0,0);
    if (selDate < startDate) return false;
    if (m.endDate) {
      const endDate = new Date(m.endDate);
      endDate.setHours(23,59,59,999);
      if (selDate > endDate) return false;
    }
    return true;
  });

  return (
    <DashboardLayout navItems={NAV_ITEMS} title="Dashboard">

      {/* Daily Vitals Modal */}
      {showVitalsModal && (
        <DailyVitalsModal
          onClose={() => setShowVitalsModal(false)}
          onSaved={fetchDashboardData}
        />
      )}

      {/* Welcome Banner */}
      <div className="glass-card p-6 mb-6 bg-gradient-to-r from-blue-600/20 to-teal-600/10 border-blue-500/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">
              Good {getGreeting()}, {user?.firstName}! 👋
            </h2>
            <p className="text-white/50 mt-1">
              You have{' '}
              <span className="text-teal-400 font-semibold">
                {isLoading ? '…' : medications.length} medication{medications.length !== 1 ? 's' : ''}
              </span>{' '}
              registered. Stay on track today!
            </p>
          </div>
          <div className="hidden sm:block text-5xl">💊</div>
        </div>
      </div>

      {/* ── MEDICATION STATS DASHBOARD ─────────────────────────────────── */}
      <div className="glass-card p-6 mb-6">
        <h3 className="text-white font-semibold mb-5 flex items-center gap-2">
          <FiTrendingUp className="w-4 h-4 text-teal-400" /> Medication Adherence
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {/* Today's Taken % */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <ProgressRing percent={todayTakenPct} color="#14b8a6" />
              <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
                {todayTakenPct}%
              </span>
            </div>
            <p className="text-white/60 text-sm text-center">Today Taken</p>
            <p className="text-teal-400 text-xs">{medStats?.today?.taken ?? 0} doses</p>
          </div>

          {/* Today's Missed % */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <ProgressRing percent={100 - todayTakenPct} color="#ef4444" />
              <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
                {100 - todayTakenPct}%
              </span>
            </div>
            <p className="text-white/60 text-sm text-center">Today Missed</p>
            <p className="text-red-400 text-xs">{medStats?.today?.missed ?? 0} doses</p>
          </div>

          {/* Overall Taken % */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <ProgressRing percent={overallTakenPct} color="#3b82f6" />
              <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
                {overallTakenPct}%
              </span>
            </div>
            <p className="text-white/60 text-sm text-center">All-time Taken</p>
            <p className="text-blue-400 text-xs">{medStats?.overall?.taken ?? 0} total</p>
          </div>

          {/* Overall Missed % */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <ProgressRing percent={100 - overallTakenPct} color="#f97316" />
              <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
                {100 - overallTakenPct}%
              </span>
            </div>
            <p className="text-white/60 text-sm text-center">All-time Missed</p>
            <p className="text-orange-400 text-xs">{medStats?.overall?.missed ?? 0} total</p>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link to="/medications" className="text-teal-400 text-sm hover:text-teal-300 transition-colors">
            View full medication schedule →
          </Link>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Medications',   value: medications.length, sub: 'Active',           icon: FiPlusCircle, color: 'from-blue-600 to-blue-400' },
          { label: 'Blood Pressure',value: bpStr,              sub: 'mmHg',             icon: FiActivity,   color: 'from-teal-600 to-teal-400' },
          { label: 'Heart Rate',    value: latestVitals?.heartRate ? `${latestVitals.heartRate}` : '—', sub: 'bpm', icon: FiTrendingUp, color: 'from-purple-600 to-purple-400' },
          { label: 'Oxygen',        value: latestVitals?.oxygenLevel ? `${latestVitals.oxygenLevel}%` : '—', sub: 'SpO2', icon: FiHeart, color: 'from-rose-600 to-rose-400' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-4`}>
              <s.icon className="w-5 h-5 text-white" />
            </div>
            <div className="text-2xl font-bold text-white">{isLoading ? '…' : s.value}</div>
            <div className="text-white/60 text-sm font-medium mt-0.5">{s.label}</div>
            <div className="text-white/30 text-xs mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Medications + Vitals grid */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Medications List */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <FiClock className="w-4 h-4 text-blue-400" /> Your Medications
              </h3>
              <input 
                type="date" 
                className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-white/70 focus:outline-none focus:border-teal-500 w-fit"
                value={selectedDateStr}
                onChange={(e) => setSelectedDateStr(e.target.value)}
              />
            </div>
            <Link to="/medications" className="text-blue-400 text-xs hover:text-blue-300">Manage →</Link>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400" />
            </div>
          ) : filteredMedications.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white/40 text-sm">No medications scheduled for this date.</p>
              <Link to="/medications" className="text-blue-400 text-xs hover:text-blue-300 mt-2 block">+ Manage schedule</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMedications.slice(0, 5).map(med => (
                <div key={med._id} className="flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-teal-400 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{med.medicineName}</div>
                    <div className="text-white/30 text-xs">{med.timeOfDay?.join(', ')}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-white/60 text-xs">{med.dosage}</div>
                    <span className="text-xs font-medium text-teal-400 capitalize">{med.frequency}</span>
                  </div>
                </div>
              ))}
              {filteredMedications.length > 5 && (
                <p className="text-white/30 text-xs text-center pt-1">+{filteredMedications.length - 5} more</p>
              )}
            </div>
          )}
        </div>

        {/* Latest Vitals */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <FiActivity className="w-4 h-4 text-teal-400" /> Latest Vitals
            </h3>
            <Link to="/vitals" className="text-blue-400 text-xs hover:text-blue-300">View All →</Link>
          </div>
          {!latestVitals ? (
            <div className="text-center py-8">
              <p className="text-white/40 text-sm">No vitals recorded yet.</p>
              <button onClick={() => setShowVitalsModal(true)} className="text-teal-400 text-xs hover:text-teal-300 mt-2 block w-full">
                + Log today's vitals
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {[
                { label: 'Blood Pressure', value: bpStr, unit: 'mmHg', pct: 75 },
                { label: 'Heart Rate',     value: latestVitals?.heartRate    || '—', unit: 'bpm',  pct: 60 },
                { label: 'Blood Sugar',    value: latestVitals?.bloodSugar   || '—', unit: 'mg/dL',pct: 50 },
                { label: 'Oxygen Level',   value: latestVitals?.oxygenLevel  || '—', unit: 'SpO2', pct: latestVitals?.oxygenLevel ? 90 : 0 },
              ].map(v => (
                <div key={v.label}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-white/60">{v.label}</span>
                    <span className="text-white font-medium">{v.value} <span className="text-white/30 text-xs">{v.unit}</span></span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-teal-400 rounded-full transition-all duration-700" style={{ width: `${v.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
};

export default PatientDashboard;
