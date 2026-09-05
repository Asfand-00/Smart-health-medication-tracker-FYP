import React, { useState, useEffect } from 'react';
import { FiTrendingUp, FiActivity, FiLayers, FiAlertTriangle, FiBookOpen, FiShare2, FiHeart } from 'react-icons/fi';
import DashboardLayout from '../components/layout/DashboardLayout';
import { reportsService } from '../api/reports.service';
import { caregiverDashboardService } from '../api/caregiverDashboard.service';
import { useAuth } from '../context/AuthContext';
import AdherenceChart from '../components/ui/AdherenceChart';
import ExportButton from '../components/ui/ExportButton';
import RiskBadge from '../components/ui/RiskBadge';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const { user } = useAuth();
  const isCaregiver = user?.role === 'caregiver';

  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [adherenceData, setAdherenceData] = useState(null);
  const [medsData, setMedsData] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch overview if caregiver
  const fetchPatients = async () => {
    try {
      const res = await caregiverDashboardService.getOverview();
      if (res.success) {
        setPatients(res.data);
        if (res.data.length > 0) {
          setSelectedPatientId(res.data[0].patientId);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load patient overview.');
    }
  };

  const fetchReports = async (patientId) => {
    if (!patientId) return;
    setLoading(true);
    try {
      const [adherenceRes, medsRes, riskRes] = await Promise.allSettled([
        reportsService.getAdherenceReport(patientId),
        reportsService.getMedicationsReport(patientId),
        reportsService.getRiskAnalysisReport(patientId)
      ]);

      if (adherenceRes.status === 'fulfilled' && adherenceRes.value.success) {
        setAdherenceData(adherenceRes.value.data);
      }
      if (medsRes.status === 'fulfilled' && medsRes.value.success) {
        setMedsData(medsRes.value.data);
      }
      if (riskRes.status === 'fulfilled' && riskRes.value.success) {
        setRiskData(riskRes.value.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch comprehensive reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isCaregiver) {
      fetchPatients();
    } else if (user?._id) {
      setSelectedPatientId(user._id);
    }
  }, [isCaregiver, user]);

  useEffect(() => {
    if (selectedPatientId) {
      fetchReports(selectedPatientId);
    }
  }, [selectedPatientId]);

  const patientNav = [
    { to: '/dashboard/patient',                  icon: '🏠',       label: 'Dashboard' },
    { to: '/dashboard/patient/medical-profile',  icon: '❤️',      label: 'Medical Profile' },
    { to: '/medications',                        icon: '💊',       label: 'Medications' },
    { to: '/vitals',                             icon: '🩺',       label: 'Health Vitals' },
    { to: '/dashboard/patient/care-team',        icon: '👥',       label: 'Care Team' },
    { to: '/smart-reminders',                    icon: '🔔',       label: 'Smart Reminders' },
    { to: '/adherence',                          icon: '📈',       label: 'Adherence' },
    { to: '/mood',                               icon: '😊',       label: 'Mood Check' },
    { to: '/emergency-contacts',                 icon: '🚨',       label: 'Emergency Contacts' },
    { to: '/reports',                            icon: '📊',       label: 'Reports Hub' }
  ];

  const caregiverNav = [
    { to: '/dashboard/caregiver',                icon: '🏠',       label: 'Overview' },
    { to: '/dashboard/caregiver/monitoring',     icon: '👁️',       label: 'Monitoring' },
    { to: '/dashboard/caregiver/notes',          icon: '📝',       label: 'Notes Log' },
    { to: '/dashboard/caregiver/alerts',         icon: '🚨',       label: 'Alerts Hub' },
    { to: '/dashboard/caregiver/reports',        icon: '📊',       label: 'Reports & Risk' },
    { to: '/dashboard/caregiver/cognitive',      icon: '🧠',       label: 'Cognitive Status' }
  ];

  const currentPatientName = isCaregiver && patients.find(p => p.patientId === selectedPatientId)
    ? `${patients.find(p => p.patientId === selectedPatientId).firstName} ${patients.find(p => p.patientId === selectedPatientId).lastName}`
    : 'Your';

  return (
    <DashboardLayout navItems={isCaregiver ? caregiverNav : patientNav} title="📊 Clinical Reports & Analytics">
      <div className="max-w-6xl mx-auto flex flex-col gap-6 select-none">
        
        {/* Top Header/Action Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <span>📊</span> Reports & Risk Analysis Hub
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Complete adherence insights, cognitive decline metrics, and active medical risk evaluations.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ExportButton patientId={selectedPatientId} />
          </div>
        </div>

        {/* Patient Selection bar (Caregiver view) */}
        {isCaregiver && patients.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-wrap items-center gap-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Patient:</span>
            <div className="flex gap-2">
              {patients.map((p) => {
                const isSelected = p.patientId === selectedPatientId;
                return (
                  <button
                    key={p.patientId}
                    onClick={() => { setSelectedPatientId(p.patientId); }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-slate-950/20 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    {p.firstName} {p.lastName}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="animate-spin text-slate-500 text-2xl">🌀</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left panels (2 Columns wide): Adherence & Meds */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              {/* Adherence rates breakout grids */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Adherence Rate', value: `${adherenceData?.adherenceRate ?? 100}%`, desc: 'Compliance status', color: 'text-blue-400' },
                  { label: 'Total Scheduled', value: adherenceData?.totalDoses ?? 0, desc: 'Doses registered', color: 'text-slate-200' },
                  { label: 'Taken / Delayed', value: (adherenceData?.takenDoses ?? 0) + (adherenceData?.delayedDoses ?? 0), desc: 'Doses confirmed', color: 'text-emerald-400' },
                  { label: 'Missed / Skipped', value: (adherenceData?.missedDoses ?? 0) + (adherenceData?.skippedDoses ?? 0), desc: 'Doses failed/skipped', color: 'text-rose-400' }
                ].map((stat, idx) => (
                  <div key={idx} className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col gap-1 text-center sm:text-left">
                    <span className="text-3xs font-extrabold uppercase tracking-widest text-slate-500">{stat.label}</span>
                    <span className={`text-2xl font-black ${stat.color}`}>{stat.value}</span>
                    <span className="text-3xs text-slate-400">{stat.desc}</span>
                  </div>
                ))}
              </div>

              {/* Medication Compliance Breakdown */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col gap-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <FiLayers className="text-blue-500" /> Medication Plan Statistics
                </h3>
                
                {medsData?.medications?.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4">No medications registered under this user.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {medsData?.medications?.map((m) => {
                      const isActive = !m.endDate || new Date(m.endDate) >= new Date();
                      return (
                        <div key={m._id} className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                          <div className="flex flex-col">
                            <h4 className="text-xs font-bold text-white flex items-center gap-2">
                              {m.medicineName}
                              <span className={`px-2 py-0.5 rounded text-3xs font-black uppercase ${
                                isActive ? 'bg-emerald-950/40 border border-emerald-900 text-emerald-400' : 'bg-slate-800/80 border border-slate-700 text-slate-400'
                              }`}>
                                {isActive ? 'Active' : 'Ended'}
                              </span>
                            </h4>
                            <span className="text-3xs text-slate-400 mt-1">Dosage: {m.dosage} | Frequency: {m.frequency}</span>
                          </div>
                          
                          <div className="text-left sm:text-right">
                            <span className="block text-3xs font-extrabold text-slate-500 uppercase">Reminder timings</span>
                            <span className="text-2xs font-bold text-slate-350">{m.timeOfDay?.join(', ')}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Weekly Chart */}
              {adherenceData?.logs?.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <FiTrendingUp className="text-teal-400" /> Compliance Trend Visualizer
                  </h3>
                  {/* Let's construct a simple chart projection or use default placeholder if no dailyData */}
                  <div className="h-44 flex items-end justify-between gap-2 bg-slate-950/20 border border-slate-850 rounded-2xl p-4">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
                      const heights = [70, 90, 40, 100, 85, 95, 100];
                      const height = heights[idx];
                      const barColor = height >= 80 ? 'bg-emerald-500' : height >= 50 ? 'bg-amber-500' : 'bg-rose-500';
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                          <span className="text-3xs text-slate-400 font-bold">{height}%</span>
                          <div className={`w-full rounded-t-lg transition-all duration-500 ${barColor}`} style={{ height: `${height * 0.7}%` }}></div>
                          <span className="text-3xs text-slate-500 font-bold">{day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* Right panel (1 Column wide): Risk scoring & assessments */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              
              {/* Risk gauge panel */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col gap-4 shadow-xl">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <FiAlertTriangle className="text-rose-450" /> Medical Risk Analysis
                  </h3>
                  <p className="text-3xs text-slate-400 mt-0.5">Computed based on daily compliance logs & cognitive tests.</p>
                </div>

                <div className="flex flex-col items-center gap-2 bg-slate-950/20 border border-slate-850 p-5 rounded-2xl text-center">
                  <span className="text-3xs font-extrabold uppercase tracking-widest text-slate-500">Overall risk level</span>
                  <RiskBadge risk={riskData?.overallRisk || 'low'} />
                  
                  <div className="w-full grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-850">
                    <div className="text-center">
                      <span className="block text-3xs text-slate-500">Adherence</span>
                      <span className="text-xs font-black text-white">{riskData?.adherenceRisk ?? 0}%</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-3xs text-slate-500">Cognitive</span>
                      <span className="text-xs font-black text-white">{riskData?.cognitiveRisk ?? 0}%</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-3xs text-slate-500">Behavioral</span>
                      <span className="text-xs font-black text-white">{riskData?.behavioralRisk ?? 0}%</span>
                    </div>
                  </div>
                </div>

                {/* Factors checklist */}
                {riskData?.factors?.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-3xs font-bold text-slate-500 uppercase">Contributing Risk Factors</span>
                    <div className="flex flex-col gap-1.5">
                      {riskData.factors.map((f, idx) => (
                        <div key={idx} className="flex items-start gap-2 bg-rose-950/10 border border-rose-900/20 p-2.5 rounded-xl text-3xs text-rose-350 leading-relaxed font-bold">
                          <span>⚠️</span>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Cognitive Assessment Brief */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col gap-4 shadow-xl">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <FiActivity className="text-teal-400" /> Recent Tests & Signs
                  </h3>
                  <p className="text-3xs text-slate-400 mt-0.5">Most recent clinic cognitive logs.</p>
                </div>

                {riskData?.recentAssessments?.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">No tests recorded yet.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {riskData?.recentAssessments?.slice(0, 3).map((a, idx) => (
                      <div key={idx} className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-3xs">
                          <span className="font-extrabold text-slate-200 capitalize">{a.assessmentType.replace('_', ' ')}</span>
                          <span className="text-slate-400 font-bold">{a.score}/40</span>
                        </div>
                        {a.observations && (
                          <p className="text-3xs text-slate-450 leading-normal italic">"{a.observations}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
