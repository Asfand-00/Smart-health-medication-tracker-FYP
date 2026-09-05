import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiTrendingUp, FiClock, FiFileText } from 'react-icons/fi';
import DashboardLayout from '../components/layout/DashboardLayout';
import { adherenceService } from '../api/adherence.service';
import AdherenceChart from '../components/ui/AdherenceChart';
import ExportButton from '../components/ui/ExportButton';
import AccessibilityToggle from '../components/ui/AccessibilityToggle';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/dashboard/patient',                  icon: '🏠',       label: 'Dashboard' },
  { to: '/smart-reminders',                    icon: '⏰',       label: 'Smart Reminders' },
  { to: '/adherence',                          icon: '📊',       label: 'My Adherence' },
  { to: '/mood',                               icon: '💖',       label: 'My Mood' },
  { to: '/medications',                        icon: '💊',       label: 'Medications' },
  { to: '/vitals',                             icon: '❤️',       label: 'Health Vitals' }
];

export default function AdherenceDashboardPage() {
  const [todayData, setTodayData] = useState(null);
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAdherenceData = async () => {
    setLoading(true);
    try {
      const [todayRes, weeklyRes] = await Promise.all([
        adherenceService.getTodayStatus(),
        adherenceService.getWeeklyReport()
      ]);

      if (todayRes.success) setTodayData(todayRes.data);
      if (weeklyRes.success) setWeeklyReport(weeklyRes.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load adherence statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdherenceData();
  }, []);

  return (
    <DashboardLayout navItems={NAV_ITEMS} title="📊 Adherence Analytics">
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">
        <AccessibilityToggle />

        {/* Top Header Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <span>📊</span> Health Adherence Summary
            </h2>
            <p className="text-xs md:text-sm text-slate-400">
              Check your medication compliance rates and export reports for your physician.
            </p>
          </div>
          <ExportButton />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Stat 1: Today's adherence */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col gap-2">
              <span className="text-3xs font-bold uppercase tracking-widest text-slate-500">Today's Rate</span>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-emerald-400">
                  {todayData?.adherencePercent ?? 0}%
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {todayData?.taken + todayData?.delayed} of {todayData?.total} doses logged as taken.
              </p>
            </div>

            {/* Stat 2: Weekly adherence */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col gap-2">
              <span className="text-3xs font-bold uppercase tracking-widest text-slate-500">Weekly Rate</span>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-blue-400">
                  {weeklyReport?.summary?.weeklyAdherencePercent ?? 0}%
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Overall adherence rate over the last 7 days.
              </p>
            </div>

            {/* Quick Link Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between">
              <div>
                <span className="text-3xs font-bold uppercase tracking-widest text-slate-500">Adherence History</span>
                <p className="text-xs text-slate-300 mt-1.5 font-medium">
                  Review dates, custom medication notes, and detailed past logs.
                </p>
              </div>
              <Link
                to="/adherence/history"
                className="mt-4 flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                <FiFileText /> View Full Log History
              </Link>
            </div>
          </div>
        )}

        {/* Charts Section */}
        {!loading && weeklyReport?.dailyData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AdherenceChart data={weeklyReport.dailyData} type="daily" />
            
            {/* Adherence Trends Analysis Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col gap-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FiTrendingUp className="text-teal-400" /> Compliance Insights
              </h3>
              
              <div className="flex flex-col gap-3 text-xs md:text-sm text-slate-300 leading-relaxed justify-center h-full">
                <p>
                  <strong>Why it matters:</strong> Consistent medication intake is critical for maintaining cognitive stability in Alzheimer's treatment.
                </p>
                <p>
                  Your current 7-day adherence is <strong className="text-blue-400">{weeklyReport?.summary?.weeklyAdherencePercent}%</strong>. 
                  {weeklyReport?.summary?.weeklyAdherencePercent >= 80 
                    ? " Excellent job! Keep maintaining this routine." 
                    : " Try setting voice prompts or asking your caregiver for scheduling help to close the gap."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
