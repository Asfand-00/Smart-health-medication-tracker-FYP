import React from 'react';

export default function RiskBadge({ level = 'low', score = 0 }) {
  const levels = {
    low: { bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', label: 'Low Risk' },
    moderate: { bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400', label: 'Moderate Risk' },
    high: { bg: 'bg-orange-500/10 border-orange-500/20 text-orange-400', label: 'High Risk' },
    critical: { bg: 'bg-rose-500/10 border-rose-500/20 text-rose-400 font-bold animate-pulse', label: 'Critical Risk' }
  };

  const current = levels[level] || levels.low;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${current.bg}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {current.label} {score > 0 && <span className="opacity-80">({score})</span>}
    </span>
  );
}
