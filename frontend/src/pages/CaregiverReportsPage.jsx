import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { caregiverDashboardService } from '../api/caregiverDashboard.service';
import { reportsService } from '../api/reports.service';
import AdherenceChart from '../components/ui/AdherenceChart';
import RiskBadge from '../components/ui/RiskBadge';
import ExportButton from '../components/ui/ExportButton';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/dashboard/caregiver',                icon: '🏠',       label: 'Overview' },
  { to: '/dashboard/caregiver/monitoring',     icon: '👁️',       label: 'Monitoring' },
  { to: '/dashboard/caregiver/notes',          icon: '📝',       label: 'Notes Log' },
  { to: '/dashboard/caregiver/alerts',         icon: '🚨',       label: 'Alerts Hub' },
  { to: '/dashboard/caregiver/reports',        icon: '📊',       label: 'Reports & Risk' }
];

export default function CaregiverReportsPage() {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [adherenceReport, setAdherenceReport] = useState(null);
  const [riskReport, setRiskReport] = useState(null);
  const [weeklyData, setWeeklyData] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);

  const fetchPatients = async () => {
    setLoadingList(true);
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
    } finally {
      setLoadingList(false);
    }
  };

  const fetchReports = async (patientId) => {
    if (!patientId) return;
    setLoadingReport(true);
    try {
      const [adhRes, riskRes, weekRes] = await Promise.all([
        reportsService.getAdherenceReport(patientId),
        reportsService.getRiskAnalysisReport(patientId),
        caregiverDashboardService.getPatientAdherence(patientId)
      ]);

      if (adhRes.success) setAdherenceReport(adhRes.data);
      if (riskRes.success) setRiskReport(riskRes.data);
      if (weekRes.success) setWeeklyData(weekRes.data?.weeklyReport);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load patient reports.');
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => { fetchPatients(); }, []);
  useEffect(() => { if (selectedPatientId) fetchReports(selectedPatientId); }, [selectedPatientId]);

  const activePatient = patients.find(p => p.patientId === selectedPatientId);

  return (
    <DashboardLayout navItems={NAV_ITEMS} title="📊 Reports & Risk Analysis">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-7xl mx-auto select-none">

        {/* Patient Selector */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Patients</h3>
          {loadingList ? (
            <div className="flex justify-center py-6"><span className="animate-spin text-slate-500">🌀</span></div>
          ) : (
            <div className="flex flex-col gap-2">
              {patients.map((p) => (
                <button
                  key={p.patientId}
                  onClick={() => setSelectedPatientId(p.patientId)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    p.patientId === selectedPatientId
                      ? 'bg-blue-600/20 border-blue-500 text-white font-bold'
                      : 'bg-slate-950/20 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="font-bold text-sm">{p.firstName} {p.lastName}</div>
                  <div className="text-3xs text-slate-500 mt-1 flex justify-between">
                    <RiskBadge level={p.riskLevel} score={p.riskScore} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reports Panel */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {selectedPatientId && activePatient ? (
            <>
              {/* Banner */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-xl font-black text-white">
                    Reports for {activePatient.firstName} {activePatient.lastName}
                  </h2>
                  <p className="text-xs text-slate-400">Comprehensive adherence analytics, risk scoring, and export options.</p>
                </div>
                <ExportButton patientId={selectedPatientId} />
              </div>

              {loadingReport ? (
                <div className="flex justify-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                </div>
              ) : (
                <>
                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-1">
                      <span className="text-3xs font-bold uppercase tracking-widest text-slate-500">Adherence Rate</span>
                      <span className="text-3xl font-black text-emerald-400">{adherenceReport?.adherenceRate ?? 0}%</span>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-1">
                      <span className="text-3xs font-bold uppercase tracking-widest text-slate-500">Doses Taken</span>
                      <span className="text-3xl font-black text-blue-400">{(adherenceReport?.takenDoses || 0) + (adherenceReport?.delayedDoses || 0)}</span>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-1">
                      <span className="text-3xs font-bold uppercase tracking-widest text-slate-500">Doses Missed</span>
                      <span className="text-3xl font-black text-rose-400">{adherenceReport?.missedDoses ?? 0}</span>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-1">
                      <span className="text-3xs font-bold uppercase tracking-widest text-slate-500">Risk Score</span>
                      <div className="flex items-center gap-2">
                        <span className="text-3xl font-black text-amber-400">{riskReport?.compositeScore ?? 0}</span>
                        <RiskBadge level={riskReport?.overallRisk || 'low'} />
                      </div>
                    </div>
                  </div>

                  {/* Charts + Risk Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Weekly Chart */}
                    {weeklyData?.dailyData && (
                      <AdherenceChart data={weeklyData.dailyData} type="daily" />
                    )}

                    {/* Risk Breakdown */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col gap-4 shadow-xl">
                      <h3 className="text-base font-bold text-white">Risk Factor Breakdown</h3>
                      <div className="flex flex-col gap-3">
                        {[
                          { label: 'Adherence Risk', value: riskReport?.adherenceRisk ?? 0, color: 'bg-blue-500' },
                          { label: 'Cognitive Risk', value: riskReport?.cognitiveRisk ?? 0, color: 'bg-amber-500' },
                          { label: 'Behavioral Risk', value: riskReport?.behavioralRisk ?? 0, color: 'bg-purple-500' },
                        ].map((r) => (
                          <div key={r.label} className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400 font-medium">{r.label}</span>
                              <span className="text-white font-bold">{r.value}%</span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div className={`h-full ${r.color} rounded-full transition-all duration-700`} style={{ width: `${r.value}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Risk Factors */}
                      {riskReport?.factors?.length > 0 && (
                        <div className="mt-4 flex flex-col gap-2">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contributing Factors</h4>
                          {riskReport.factors.map((f, i) => (
                            <div key={i} className="bg-slate-950/40 border border-slate-850 rounded-xl p-3 text-xs text-slate-300">
                              <span className="font-bold text-white">{f.factor}</span>
                              <span className="text-slate-500 ml-2">(weight: {f.weight})</span>
                              <p className="text-slate-400 mt-0.5">{f.description}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-16 text-center text-slate-500 text-sm">
              Select a patient to view their reports.
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
