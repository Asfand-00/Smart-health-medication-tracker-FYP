import React, { useState, useEffect, useCallback } from 'react';
import { FiClock, FiRefreshCw, FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';
import DashboardLayout from '../components/layout/DashboardLayout';
import { smartReminderService } from '../api/smartReminder.service';
import { useAccessibility } from '../context/AccessibilityContext';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/dashboard/patient',   icon: '🏠', label: 'Dashboard' },
  { to: '/smart-reminders',     icon: '⏰', label: 'Smart Reminders' },
  { to: '/adherence',           icon: '📊', label: 'My Adherence' },
  { to: '/mood',                icon: '💖', label: 'My Mood' },
  { to: '/medications',         icon: '💊', label: 'Medications' },
  { to: '/vitals',              icon: '❤️', label: 'Health Vitals' },
  { to: '/emergency-contacts',  icon: '🛡️', label: 'Emergency Support' },
  { to: '/reports',             icon: '📈', label: 'Reports Hub' }
];

// Time of day visual mapping
const TIME_STYLES = {
  Morning:   { emoji: '☀️', gradient: 'from-amber-500/20 to-orange-500/10', border: 'border-amber-500/30', text: 'text-amber-300' },
  Afternoon: { emoji: '🌤️', gradient: 'from-sky-500/20 to-blue-500/10',    border: 'border-sky-500/30',   text: 'text-sky-300' },
  Evening:   { emoji: '🌇', gradient: 'from-orange-500/20 to-red-500/10',  border: 'border-orange-500/30', text: 'text-orange-300' },
  Night:     { emoji: '🌙', gradient: 'from-indigo-500/20 to-purple-500/10', border: 'border-indigo-500/30', text: 'text-indigo-300' }
};

export default function SmartRemindersPage() {
  const { speakText } = useAccessibility();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [error, setError] = useState(null);
  const { socket } = useSocket();

  const fetchUpcomingReminders = useCallback(async (showGenerateToast = false) => {
    setLoading(true);
    setError(null);
    try {
      // Generate first (creates any missing reminders for today)
      if (showGenerateToast) setGenerating(true);
      const genRes = await smartReminderService.generateReminders();
      if (showGenerateToast && genRes.data?.length > 0) {
        toast.success(`Generated ${genRes.data.length} new reminders`);
      }
      if (showGenerateToast) setGenerating(false);

      // Then fetch all upcoming for today
      const res = await smartReminderService.getUpcomingReminders();
      if (res.success) {
        setReminders(res.data || []);
      }
    } catch (err) {
      console.error('Smart Reminders fetch error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load reminders');
      toast.error('Failed to load medication reminders.');
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  }, []);

  useEffect(() => {
    fetchUpcomingReminders(true);
  }, [fetchUpcomingReminders]);

  // Listen for real-time updates
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchUpcomingReminders(false);
    
    socket.on('medication_logged', handleUpdate);
    socket.on('medication_updated', handleUpdate);
    socket.on('adherence_update', handleUpdate);

    return () => {
      socket.off('medication_logged', handleUpdate);
      socket.off('medication_updated', handleUpdate);
      socket.off('adherence_update', handleUpdate);
    };
  }, [socket, fetchUpcomingReminders]);

  // Confirm / Skip / Delay dose
  const handleConfirmDose = async (reminderId, status) => {
    setConfirmingId(reminderId);
    try {
      const res = await smartReminderService.acknowledgeReminder(reminderId, { status });
      if (res.success) {
        toast.success(`Dose marked as ${status}! ✅`);
        setSelectedReminder(null);
        
        // Remove from list immediately for instant UI feedback
        setReminders(prev => prev.filter(r => r._id !== reminderId));
        
        // TTS voice feedback
        if (status === 'taken') {
          speakText("Thank you. Your dosage has been successfully recorded and your caregiver has been notified.");
        } else if (status === 'delayed') {
          speakText("Noted. We will remind you again shortly.");
        } else {
          speakText("Recorded. Your caregiver has been notified about this skipped dose.");
        }
      }
    } catch (err) {
      console.error('Confirm dose error:', err);
      toast.error(err.response?.data?.message || 'Failed to update dose confirmation.');
    } finally {
      setConfirmingId(null);
    }
  };

  // Extract time of day from reminder title
  const getTimeOfDay = (reminder) => {
    const title = (reminder.title || '').toLowerCase();
    if (title.includes('morning')) return 'Morning';
    if (title.includes('afternoon')) return 'Afternoon';
    if (title.includes('evening')) return 'Evening';
    if (title.includes('night')) return 'Night';
    return 'Morning';
  };

  return (
    <DashboardLayout navItems={NAV_ITEMS} title="⏰ Smart Reminders">
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">

        {/* Header Summary */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/50 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <span>⏰</span> Medication Schedule for Today
            </h2>
            <p className="text-xs md:text-sm text-slate-400">
              {loading ? 'Loading your schedule...' :
               reminders.length > 0 
                ? `You have ${reminders.length} pending medication${reminders.length > 1 ? 's' : ''}. Tap to confirm.`
                : 'All caught up! No pending medications scheduled.'}
            </p>
          </div>
          
          <button
            onClick={() => fetchUpcomingReminders(true)}
            disabled={loading || generating}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 active:scale-95 text-white text-sm font-bold rounded-xl transition cursor-pointer shadow-lg shadow-blue-500/20"
          >
            <FiRefreshCw className={loading || generating ? 'animate-spin' : ''} />
            {generating ? 'Generating...' : 'Refresh Schedule'}
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-950/40 border border-red-800/50 rounded-2xl p-4 flex items-center gap-3">
            <FiAlertCircle className="text-red-400 w-5 h-5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-300">Something went wrong</p>
              <p className="text-xs text-red-400/80">{error}</p>
            </div>
            <button onClick={() => fetchUpcomingReminders(false)} className="ml-auto px-3 py-1 bg-red-800/50 hover:bg-red-700/50 text-red-200 text-xs rounded-lg cursor-pointer">
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
              <p className="text-sm text-slate-400">Loading your medications...</p>
            </div>
          </div>
        ) : reminders.length === 0 && !error ? (
          /* Empty State */
          <div className="bg-slate-900/40 border-2 border-dashed border-slate-800 rounded-3xl p-16 text-center flex flex-col items-center gap-4">
            <div className="text-6xl">🎉</div>
            <h3 className="text-xl font-bold text-white">No Pending Medications</h3>
            <p className="text-xs md:text-sm text-slate-400 max-w-md">
              Awesome job staying healthy! We will notify you when it is time for your next scheduled medicine.
            </p>
          </div>
        ) : (
          /* Reminders List */
          <div className="flex flex-col gap-4">
            {reminders.map((reminder) => {
              const med = reminder.medicationId;
              const timeOfDay = getTimeOfDay(reminder);
              const timeStyle = TIME_STYLES[timeOfDay] || TIME_STYLES.Morning;
              const isConfirming = confirmingId === reminder._id;
              const isSelected = selectedReminder?._id === reminder._id;

              return (
                <div key={reminder._id} className="flex flex-col">
                  {/* Medication Reminder Card */}
                  <div
                    className={`bg-gradient-to-r ${timeStyle.gradient} border ${timeStyle.border} rounded-3xl p-5 md:p-6 shadow-xl transition-all duration-300 ${isSelected ? 'ring-2 ring-blue-500' : 'hover:shadow-2xl hover:scale-[1.01]'}`}
                  >
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                      {/* Left: Medication Info */}
                      <div className="flex items-center gap-4 text-center md:text-left w-full md:w-auto">
                        {/* Pill Icon */}
                        <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-slate-950/60 border-2 ${timeStyle.border} flex items-center justify-center text-3xl md:text-4xl flex-shrink-0`}>
                          💊
                        </div>
                        
                        <div className="flex flex-col gap-1.5 min-w-0">
                          <h4 className="text-xl md:text-2xl font-black text-white truncate">
                            {med?.medicineName || 'Medication'}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
                            <span className="px-3 py-1 bg-slate-800/80 border border-slate-700 rounded-xl text-xs font-bold text-slate-300">
                              💊 {med?.dosage || 'As prescribed'}
                            </span>
                            <span className={`px-3 py-1 bg-slate-800/80 border border-slate-700 rounded-xl text-xs font-bold ${timeStyle.text}`}>
                              {timeStyle.emoji} {timeOfDay}
                            </span>
                          </div>
                          {med?.notes && (
                            <p className="text-xs text-slate-400 mt-1 italic">
                              💡 {med.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Action Buttons */}
                      <div className="flex flex-col gap-2 w-full md:w-auto md:min-w-[180px]">
                        {/* TAKEN - Big Green Button */}
                        <button
                          onClick={() => handleConfirmDose(reminder._id, 'taken')}
                          disabled={isConfirming}
                          className="w-full py-4 md:py-5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-50 text-slate-950 font-black text-lg md:text-xl rounded-2xl shadow-xl transition cursor-pointer border-b-4 border-emerald-700 flex items-center justify-center gap-2"
                        >
                          {isConfirming ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-950" />
                          ) : (
                            <>✅ I TOOK IT</>
                          )}
                        </button>

                        <div className="grid grid-cols-2 gap-2">
                          {/* DELAY Button */}
                          <button
                            onClick={() => handleConfirmDose(reminder._id, 'delayed')}
                            disabled={isConfirming}
                            className="py-3 bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-50 text-slate-950 font-extrabold text-sm rounded-xl shadow-md transition cursor-pointer border-b-2 border-amber-700 flex items-center justify-center gap-1"
                          >
                            ⏱️ LATER
                          </button>

                          {/* SKIP Button */}
                          <button
                            onClick={() => handleConfirmDose(reminder._id, 'skipped')}
                            disabled={isConfirming}
                            className="py-3 bg-rose-600 hover:bg-rose-500 active:scale-95 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl shadow-md transition cursor-pointer border-b-2 border-rose-800 flex items-center justify-center gap-1"
                          >
                            ❌ SKIP
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info Footer */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex items-center gap-3">
          <span className="text-2xl">💡</span>
          <p className="text-xs md:text-sm text-slate-300">
            <strong>Caregiver Notified:</strong> Every dose you take or skip is automatically shared with your caregiver in real-time. If a dose goes unconfirmed for 30 minutes, escalation alerts will trigger automatically.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
