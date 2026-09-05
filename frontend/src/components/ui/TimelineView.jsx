import React from 'react';

const EVENT_ICONS = {
  adherence: { icon: '💊', color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
  vitals: { icon: '❤️', color: 'bg-rose-500/10 border-rose-500/20 text-rose-400' },
  caregiver_note: { icon: '📝', color: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
  cognitive_assessment: { icon: '🧠', color: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
  behavioral_observation: { icon: '👁️', color: 'bg-purple-500/10 border-purple-500/20 text-purple-400' },
  mood: { icon: '💖', color: 'bg-pink-500/10 border-pink-500/20 text-pink-400' }
};

export default function TimelineView({ events = [] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-slate-800 rounded-2xl">
        No recent timeline events found.
      </div>
    );
  }

  return (
    <div className="relative pl-6 border-l-2 border-slate-800 flex flex-col gap-6 select-none">
      {events.map((ev, idx) => {
        const style = EVENT_ICONS[ev.type] || EVENT_ICONS.adherence;
        const timeString = new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateString = new Date(ev.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

        return (
          <div key={idx} className="relative group">
            {/* Left Dot/Icon */}
            <div className={`absolute -left-[38px] top-1.5 w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm shadow bg-slate-950 ${style.color}`}>
              {style.icon}
            </div>

            {/* Event Content Card */}
            <div className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 transition-all flex flex-col gap-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-1">
                <span className="text-sm font-black text-white">{ev.title}</span>
                <span className="text-3xs md:text-2xs font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg w-max">
                  {dateString} at {timeString}
                </span>
              </div>

              <p className="text-xs md:text-sm text-slate-300 font-medium">
                {ev.message}
              </p>

              {ev.notes && (
                <div className="text-2xs md:text-xs text-slate-500 italic bg-slate-950/20 px-2.5 py-1.5 rounded-lg border border-slate-850">
                  {ev.notes}
                </div>
              )}

              {/* Status Indicator */}
              {ev.status && (
                <div className="flex justify-end mt-1">
                  <span className={`px-2 py-0.5 rounded text-4xs font-extrabold uppercase tracking-widest ${
                    ['taken', 'low', 'mild', 'normal', 'success'].includes(ev.status.toLowerCase())
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-900'
                      : ['delayed', 'medium', 'moderate', 'warning'].includes(ev.status.toLowerCase())
                      ? 'bg-amber-950 text-amber-400 border border-amber-900'
                      : 'bg-rose-950 text-rose-400 border border-rose-900 animate-pulse'
                  }`}>
                    {ev.status}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
