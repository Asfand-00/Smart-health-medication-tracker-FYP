import React from 'react';

// Pill visual mapping helpers
const SHAPES = {
  round: { icon: '⚪', label: 'Round pill' },
  oval: { icon: '💊', label: 'Oval pill' },
  capsule: { icon: '💊', label: 'Capsule' },
  square: { icon: '⬜', label: 'Square tablet' },
  triangle: { icon: '🔺', label: 'Triangle tablet' },
  liquid: { icon: '🧪', label: 'Liquid medicine' },
  inhaler: { icon: '💨', label: 'Inhaler' }
};

const COLORS = {
  white: { hex: '#ffffff', border: 'border-slate-300', text: 'text-slate-800' },
  yellow: { hex: '#eab308', border: 'border-yellow-400', text: 'text-yellow-400' },
  blue: { hex: '#3b82f6', border: 'border-blue-400', text: 'text-blue-400' },
  red: { hex: '#ef4444', border: 'border-red-400', text: 'text-red-400' },
  green: { hex: '#10b981', border: 'border-green-400', text: 'text-green-400' },
  pink: { hex: '#ec4899', border: 'border-pink-400', text: 'text-pink-400' },
  orange: { hex: '#f97316', border: 'border-orange-400', text: 'text-orange-400' }
};

const TIMINGS = {
  Morning: { icon: '☀️', bg: 'bg-amber-950/20 border-amber-800/40 text-amber-300' },
  Afternoon: { icon: '🌤️', bg: 'bg-sky-950/20 border-sky-800/40 text-sky-300' },
  Evening: { icon: '🌇', bg: 'bg-orange-950/20 border-orange-800/40 text-orange-300' },
  Night: { icon: '🌙', bg: 'bg-indigo-950/20 border-indigo-800/40 text-indigo-300' }
};

export default function MedicationCard({ medication, onLogDose, showLogActions = false }) {
  if (!medication) return null;

  // Extract pill physical qualities from description/metadata if present, else fallback
  const descLower = (medication.description || '').toLowerCase();
  
  let pillShape = 'oval';
  if (descLower.includes('round') || descLower.includes('circle')) pillShape = 'round';
  else if (descLower.includes('capsule')) pillShape = 'capsule';
  else if (descLower.includes('liquid') || descLower.includes('syrup')) pillShape = 'liquid';
  else if (descLower.includes('inhaler') || descLower.includes('spray')) pillShape = 'inhaler';

  let pillColor = 'white';
  if (descLower.includes('yellow')) pillColor = 'yellow';
  else if (descLower.includes('blue')) pillColor = 'blue';
  else if (descLower.includes('red') || descLower.includes('pink')) pillColor = 'red';
  else if (descLower.includes('green')) pillColor = 'green';
  else if (descLower.includes('orange')) pillColor = 'orange';

  const shapeInfo = SHAPES[pillShape] || SHAPES.oval;
  const colorInfo = COLORS[pillColor] || COLORS.white;

  return (
    <div className="bg-slate-900/90 border-2 border-slate-800 hover:border-slate-700/80 rounded-3xl p-5 md:p-6 shadow-xl flex flex-col md:flex-row gap-5 items-center justify-between transition-all">
      <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left w-full md:w-auto">
        {/* Pill visual representation (Large icon) */}
        <div 
          className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl border-3 shadow-inner bg-slate-950/60 ${colorInfo.border}`}
          style={{ textShadow: '0 0 10px rgba(0,0,0,0.5)' }}
        >
          {shapeInfo.icon}
        </div>

        <div className="flex flex-col gap-1.5">
          <h4 className="text-xl md:text-2xl font-black text-white">{medication.medicineName}</h4>
          
          <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
            <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-slate-300">
              Dosage: {medication.dosage}
            </span>
            <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-slate-300">
              Pill: <span className="capitalize">{pillColor}</span> {shapeInfo.label}
            </span>
          </div>

          {medication.notes && (
            <p className="text-xs md:text-sm text-slate-400 mt-1.5 italic bg-slate-950/20 px-3 py-1.5 rounded-lg border border-slate-850">
              💡 {medication.notes}
            </p>
          )}

          {/* Timings */}
          <div className="flex flex-wrap gap-1.5 mt-2 justify-center md:justify-start">
            {medication.timeOfDay.map((time) => {
              const timing = TIMINGS[time] || TIMINGS.Morning;
              return (
                <span key={time} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-2xs font-bold border ${timing.bg}`}>
                  <span>{timing.icon}</span> {time}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {showLogActions && onLogDose && (
        <div className="flex flex-col gap-2 w-full md:w-auto min-w-[140px]">
          <button
            onClick={() => onLogDose(medication._id, 'taken')}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-sm rounded-xl transition cursor-pointer shadow border-b-3 border-emerald-700 flex items-center justify-center gap-1.5"
          >
            <span>✅</span> Took It
          </button>
          <button
            onClick={() => onLogDose(medication._id, 'skipped')}
            className="w-full py-2 bg-slate-800 hover:bg-slate-750 active:scale-95 text-rose-400 hover:text-rose-300 border border-slate-700 hover:border-slate-600 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>❌</span> Skip Dose
          </button>
        </div>
      )}
    </div>
  );
}
