import React, { useState, useEffect } from 'react';
import { FiChevronLeft, FiChevronRight, FiSearch } from 'react-icons/fi';
import DashboardLayout from '../components/layout/DashboardLayout';
import { adherenceService } from '../api/adherence.service';
import { medicationService } from '../api/medication.service';
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

export default function AdherenceHistoryPage() {
  const [logs, setLogs] = useState([]);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [medicationId, setMedicationId] = useState('');
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchFiltersData = async () => {
    try {
      const res = await medicationService.getAll();
      if (res.success) setMedications(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await adherenceService.getHistory({
        medicationId,
        status,
        startDate,
        endDate,
        page,
        limit: 15
      });
      if (res.success) {
        setLogs(res.data.logs);
        setTotalPages(res.data.totalPages);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load compliance logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiltersData();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, medicationId, status, startDate, endDate]);

  const handleResetFilters = () => {
    setMedicationId('');
    setStatus('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <DashboardLayout navItems={NAV_ITEMS} title="📋 Compliance Logs">
      <div className="flex flex-col gap-6 max-w-5xl mx-auto">
        <AccessibilityToggle />

        {/* Header Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-black text-white">📋 Detailed Compliance Logs</h2>
            <p className="text-xs md:text-sm text-slate-400">Search and audit all recorded dose responses.</p>
          </div>
          <ExportButton />
        </div>

        {/* Filters Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-2xs font-bold text-slate-400 uppercase mb-1.5">Medication</label>
            <select
              value={medicationId}
              onChange={(e) => { setMedicationId(e.target.value); setPage(1); }}
              className="w-full bg-slate-800 border border-slate-700/80 rounded-xl p-2.5 text-slate-200 text-xs focus:outline-none"
            >
              <option value="">All Medications</option>
              {medications.map(m => (
                <option key={m._id} value={m._id}>{m.medicineName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-2xs font-bold text-slate-400 uppercase mb-1.5">Status</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="w-full bg-slate-800 border border-slate-700/80 rounded-xl p-2.5 text-slate-200 text-xs focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="taken">Taken</option>
              <option value="delayed">Delayed</option>
              <option value="skipped">Skipped</option>
              <option value="missed">Missed</option>
            </select>
          </div>

          <div>
            <label className="block text-2xs font-bold text-slate-400 uppercase mb-1.5">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="w-full bg-slate-800 border border-slate-700/80 rounded-xl p-2 text-slate-200 text-xs focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-2xs font-bold text-slate-400 uppercase mb-1.5">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="w-full bg-slate-800 border border-slate-700/80 rounded-xl p-2 text-slate-200 text-xs focus:outline-none"
            />
          </div>

          <button
            onClick={handleResetFilters}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
          >
            Reset Filters
          </button>
        </div>

        {/* History Table/List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-slate-900/40 border border-dashed border-slate-850 rounded-3xl p-16 text-center text-slate-400 text-sm">
            No logs matched your current filters.
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs md:text-sm">
                <thead>
                  <tr className="bg-slate-950/40 border-b border-slate-800 text-slate-400 text-2xs font-bold uppercase tracking-wider">
                    <th className="p-4">Date</th>
                    <th className="p-4">Time</th>
                    <th className="p-4">Medication</th>
                    <th className="p-4">Dosage</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Confirmed At</th>
                    <th className="p-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {logs.map((log) => {
                    const dateStr = new Date(log.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                    const timeStr = log.confirmedAt ? new Date(log.confirmedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
                    
                    const statuses = {
                      taken: 'bg-emerald-950 text-emerald-400 border-emerald-900',
                      delayed: 'bg-amber-950 text-amber-400 border-amber-900',
                      skipped: 'bg-rose-950 text-rose-400 border-rose-900',
                      missed: 'bg-rose-950 text-rose-400 border-rose-900 animate-pulse'
                    };

                    return (
                      <tr key={log._id} className="hover:bg-slate-950/20 text-slate-200">
                        <td className="p-4 font-semibold">{dateStr}</td>
                        <td className="p-4 text-slate-400 font-medium">{log.timeOfDay}</td>
                        <td className="p-4 font-bold text-white">{log.medicationId?.medicineName || 'Medication'}</td>
                        <td className="p-4 text-slate-400">{log.medicationId?.dosage || '—'}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded border text-3xs font-extrabold uppercase tracking-wider ${statuses[log.status] || statuses.missed}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400">{timeStr}</td>
                        <td className="p-4 text-slate-500 italic max-w-xs truncate" title={log.notes}>
                          {log.notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center px-6 py-4 bg-slate-950/20 border-t border-slate-800">
                <span className="text-xs text-slate-500 font-semibold">Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg disabled:opacity-40 disabled:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <FiChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg disabled:opacity-40 disabled:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <FiChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
