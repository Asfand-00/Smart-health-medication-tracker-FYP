import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import MoodSelector from '../components/ui/MoodSelector';
import AccessibilityToggle from '../components/ui/AccessibilityToggle';
import { caregiverDashboardService } from '../api/caregiverDashboard.service';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/dashboard/patient',                  icon: '🏠',       label: 'Dashboard' },
  { to: '/smart-reminders',                    icon: '⏰',       label: 'Smart Reminders' },
  { to: '/adherence',                          icon: '📊',       label: 'My Adherence' },
  { to: '/mood',                               icon: '💖',       label: 'My Mood' },
  { to: '/medications',                        icon: '💊',       label: 'Medications' },
  { to: '/vitals',                             icon: '❤️',       label: 'Health Vitals' }
];

const MOOD_EMOJIS = {
  happy: '😊',
  calm: '😌',
  anxious: '😰',
  confused: '😕',
  agitated: '😠',
  sad: '😢',
  frustrated: '😣',
  other: '❓'
};

export default function PatientMoodPage() {
  const { user } = useAuth();
  const [moodHistory, setMoodHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchMoodHistory = async () => {
    setLoading(true);
    try {
      const res = await caregiverDashboardService.getMoodHistory(user._id || user.id);
      if (res.success) {
        setMoodHistory(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchMoodHistory();
  }, [user]);

  const handleMoodSelect = async (moodData) => {
    setSubmitting(true);
    try {
      const res = await caregiverDashboardService.logMood({
        ...moodData,
        patientUserId: user._id || user.id
      });
      if (res.success) {
        toast.success('Mood logged successfully!');
        fetchMoodHistory();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to log mood.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout navItems={NAV_ITEMS} title="💖 My Mood">
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">
        <AccessibilityToggle />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Mood Logger Form */}
          <div className="flex flex-col gap-4">
            <MoodSelector onSelect={handleMoodSelect} isLoading={submitting} />
          </div>

          {/* Mood History Logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
            <div>
              <h3 className="text-lg font-black text-white">Mood History</h3>
              <p className="text-xs text-slate-400">Review your past logs.</p>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : moodHistory.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                No moods recorded yet. Log your first mood on the left!
              </div>
            ) : (
              <div className="flex flex-col gap-3 overflow-y-auto max-h-[400px] pr-2">
                {moodHistory.map((item) => {
                  const dateStr = new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' });
                  const timeStr = new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div 
                      key={item._id}
                      className="bg-slate-950/40 border border-slate-850 rounded-2xl p-3.5 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{MOOD_EMOJIS[item.mood] || '❓'}</span>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white capitalize">{item.mood}</span>
                          <span className="text-3xs text-slate-400">Energy Level: {item.energyLevel}/5</span>
                          {item.notes && <p className="text-xs text-slate-500 italic mt-1">{item.notes}</p>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 text-3xs font-semibold text-slate-400">
                        <div>{dateStr}</div>
                        <div>{timeStr}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
