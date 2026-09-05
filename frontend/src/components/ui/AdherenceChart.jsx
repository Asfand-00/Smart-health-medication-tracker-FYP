import React from 'react';

export default function AdherenceChart({ data = [], type = 'daily' }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 border border-slate-700/60 rounded-2xl flex items-center justify-center bg-slate-800/40 text-slate-400 text-xs">
        No chart data available for this range.
      </div>
    );
  }

  // Dimensions
  const width = 500;
  const height = 220;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Render Bar Chart (Daily completion over 7 days)
  if (type === 'daily') {
    const barWidth = Math.min(32, chartWidth / data.length - 16);
    const spacing = (chartWidth - barWidth * data.length) / (data.length - 1);

    return (
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">7-Day Completion Rates</span>
          <div className="flex gap-4 text-2xs text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-500 rounded"></span> Adherence %</span>
          </div>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
          {/* Y Axis Grid Lines & Labels */}
          {[0, 25, 50, 75, 100].map((val) => {
            const y = paddingTop + chartHeight - (val / 100) * chartHeight;
            return (
              <g key={val} className="opacity-40">
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#334155"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  fill="#94a3b8"
                  fontSize="10"
                  textAnchor="end"
                  fontFamily="sans-serif"
                >
                  {val}%
                </text>
              </g>
            );
          })}

          {/* Render Bars */}
          {data.map((day, idx) => {
            const rate = day.adherencePercent || 0;
            const barHeight = (rate / 100) * chartHeight;
            const x = paddingLeft + idx * (barWidth + spacing);
            const y = paddingTop + chartHeight - barHeight;

            // Highlight color based on adherence score
            const barColor = rate >= 80 ? '#10b981' : rate >= 50 ? '#f59e0b' : '#ef4444';

            return (
              <g key={idx} className="group">
                {/* Background column guide */}
                <rect
                  x={x - 4}
                  y={paddingTop}
                  width={barWidth + 8}
                  height={chartHeight}
                  fill="rgba(51, 65, 85, 0.08)"
                  rx="4"
                />

                {/* Main filled bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(4, barHeight)} // Minimum height so 0% shows a small sliver
                  fill={barColor}
                  rx="4"
                  className="transition-all duration-300 hover:brightness-110"
                />

                {/* Score badge text above the bar */}
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="sans-serif"
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                >
                  {rate}%
                </text>

                {/* X Axis Label */}
                <text
                  x={x + barWidth / 2}
                  y={paddingTop + chartHeight + 16}
                  fill="#94a3b8"
                  fontSize="11"
                  fontWeight="medium"
                  textAnchor="middle"
                  fontFamily="sans-serif"
                >
                  {day.dayName}
                </text>
                <text
                  x={x + barWidth / 2}
                  y={paddingTop + chartHeight + 28}
                  fill="#475569"
                  fontSize="9"
                  textAnchor="middle"
                  fontFamily="sans-serif"
                >
                  {day.taken}/{day.total}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  // Render Line Chart (Weekly trends)
  if (type === 'weekly') {
    const pointsCount = data.length;
    const spacing = chartWidth / (pointsCount - 1 || 1);

    // Compute point coordinates
    const points = data.map((week, idx) => {
      const rate = week.adherencePercent || 0;
      const x = paddingLeft + idx * spacing;
      const y = paddingTop + chartHeight - (rate / 100) * chartHeight;
      return { x, y, rate, label: `Wk ${week.week}` };
    });

    const pathD = points.reduce((acc, p, idx) => {
      return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');

    const areaD = pointsCount > 0 
      ? `${pathD} L ${points[pointsCount - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
      : '';

    return (
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Weekly Trends</span>
          <div className="flex gap-4 text-2xs text-slate-400">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block"></span> Adherence Trend</span>
          </div>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
          {/* Y Axis Grid Lines & Labels */}
          {[0, 25, 50, 75, 100].map((val) => {
            const y = paddingTop + chartHeight - (val / 100) * chartHeight;
            return (
              <g key={val} className="opacity-40">
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#334155"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  fill="#94a3b8"
                  fontSize="10"
                  textAnchor="end"
                  fontFamily="sans-serif"
                >
                  {val}%
                </text>
              </g>
            );
          })}

          {/* Area under the line */}
          {areaD && (
            <path
              d={areaD}
              fill="url(#weeklyGrad)"
              opacity="0.15"
            />
          )}

          {/* Trend Line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Gradients definitions */}
          <defs>
            <linearGradient id="weeklyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Render Points */}
          {points.map((p, idx) => {
            return (
              <g key={idx} className="group">
                {/* Hover target circle */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="8"
                  fill="rgba(59, 130, 246, 0.2)"
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                />
                {/* Main point circle */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="4.5"
                  fill="#3b82f6"
                  stroke="#1e293b"
                  strokeWidth="1.5"
                />

                {/* Score badge text above the point */}
                <text
                  x={p.x}
                  y={p.y - 10}
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="sans-serif"
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                >
                  {p.rate}%
                </text>

                {/* X Axis Label */}
                <text
                  x={p.x}
                  y={paddingTop + chartHeight + 18}
                  fill="#94a3b8"
                  fontSize="11"
                  fontWeight="medium"
                  textAnchor="middle"
                  fontFamily="sans-serif"
                >
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  return null;
}
