/**
 * ANALYTICS SERVICE — analytics.service.js
 * ==========================================
 * Health Analytics & Reporting: vitals and mood trends, data-driven
 * insights, performance over time (monthly), and CSV exports for vitals /
 * medications / the full report.
 */

const Vitals = require("../vitals/vitals.model");
const MoodTracking = require("../patient/moodTracking.model");
const CognitiveAssessment = require("../patient/cognitiveAssessment.model");
const AdherenceLog = require("../adherence/adherenceLog.model");
const Medication = require("../medication/medication.model");
const adherenceService = require("../adherence/adherence.service");

const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const round1 = (n) => Math.round(n * 10) / 10;

/** Least-squares slope sign over an array of {x: index, y} */
const trendOf = (values) => {
  const pts = values.filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (pts.length < 3) return { direction: "insufficient", slopePerDay: null };
  const n = pts.length;
  const xMean = (n - 1) / 2;
  const yMean = pts.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  pts.forEach((y, x) => {
    num += (x - xMean) * (y - yMean);
    den += (x - xMean) ** 2;
  });
  const slope = den ? num / den : 0;
  const rel = yMean ? slope / Math.abs(yMean) : 0;
  return { direction: rel > 0.005 ? "rising" : rel < -0.005 ? "falling" : "stable", slopePerDay: round1(slope * 10) / 10 };
};

const stats = (values) => {
  const v = values.filter((x) => typeof x === "number" && !Number.isNaN(x));
  if (!v.length) return { min: null, max: null, avg: null, latest: null, count: 0 };
  return { min: Math.min(...v), max: Math.max(...v), avg: round1(v.reduce((s, x) => s + x, 0) / v.length), latest: v[v.length - 1], count: v.length };
};

const VITAL_RANGES = {
  systolic: { low: 90, high: 140, label: "Systolic BP", unit: "mmHg" },
  diastolic: { low: 60, high: 90, label: "Diastolic BP", unit: "mmHg" },
  heartRate: { low: 50, high: 100, label: "Heart rate", unit: "bpm" },
  bloodSugar: { low: 70, high: 180, label: "Blood sugar", unit: "mg/dL" },
  temperature: { low: 36, high: 37.8, label: "Temperature", unit: "°C" },
  oxygenLevel: { low: 94, high: 100, label: "Oxygen", unit: "%" },
  weight: { low: null, high: null, label: "Weight", unit: "kg" },
};

const getHealthTrends = async (patientUserId, days = 30) => {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const [vitals, moods, cognitive, weekly] = await Promise.all([
    Vitals.find({ patientId: patientUserId, recordedAt: { $gte: since } }).sort({ recordedAt: 1 }),
    MoodTracking.find({ patientUserId, date: { $gte: since } }).sort({ date: 1 }),
    CognitiveAssessment.find({ patientUserId }).sort({ assessmentDate: 1 }).limit(20),
    adherenceService.getWeeklyReport(patientUserId),
  ]);

  const series = {};
  const metricOf = (v, key) => (key === "systolic" ? v.bloodPressure?.systolic : key === "diastolic" ? v.bloodPressure?.diastolic : v[key]);
  Object.keys(VITAL_RANGES).forEach((key) => {
    const points = vitals.map((v) => ({ date: v.recordedAt, value: metricOf(v, key) })).filter((p) => typeof p.value === "number");
    const values = points.map((p) => p.value);
    const range = VITAL_RANGES[key];
    const outOfRange = points.filter((p) => (range.low !== null && p.value < range.low) || (range.high !== null && p.value > range.high)).length;
    series[key] = { ...range, points, stats: stats(values), trend: trendOf(values), outOfRange };
  });

  // Adherence daily series over the window
  const logs = await AdherenceLog.find({ userId: patientUserId, date: { $gte: since } });
  const byDay = new Map();
  const now = new Date();
  logs.forEach((l) => {
    const k = dateKey(new Date(l.date));
    const cur = byDay.get(k) || { taken: 0, total: 0 };
    let status = l.status;
    if (status === "pending") {
      const due = new Date(l.date);
      due.setHours({ Morning: 8, Afternoon: 13, Evening: 18, Night: 21 }[l.timeOfDay] || 8, 30);
      status = due < now ? "missed" : "pending";
    }
    if (status === "pending") return;
    cur.total += 1;
    if (status === "taken" || status === "delayed") cur.taken += 1;
    byDay.set(k, cur);
  });
  const adherenceSeries = [...byDay.entries()].sort().map(([date, v]) => ({ date, taken: v.taken, total: v.total, percent: v.total ? Math.round((v.taken / v.total) * 100) : null }));

  const moodScore = { happy: 5, calm: 4, other: 3, sad: 2, frustrated: 2, anxious: 2, confused: 1, agitated: 1 };
  const moodSeries = moods.map((m) => ({ date: m.date, mood: m.mood, score: moodScore[m.mood] ?? 3, energy: m.energyLevel }));
  const cognitiveSeries = cognitive.map((c) => ({ date: c.assessmentDate, score: c.score, maxScore: c.maxScore, percent: Math.round((c.score / c.maxScore) * 100), type: c.assessmentType }));

  return {
    days,
    since,
    vitals: series,
    adherence: { series: adherenceSeries, trend: trendOf(adherenceSeries.map((d) => d.percent)), weeklyPercent: weekly.summary.weeklyAdherencePercent },
    mood: { series: moodSeries, stats: stats(moodSeries.map((m) => m.score)), trend: trendOf(moodSeries.map((m) => m.score)) },
    cognitive: { series: cognitiveSeries, trend: trendOf(cognitiveSeries.map((c) => c.percent)) },
  };
};

const getInsights = async (patientUserId, days = 30) => {
  const trends = await getHealthTrends(patientUserId, days);
  const insights = [];
  const add = (severity, title, detail) => insights.push({ severity, title, detail });

  Object.entries(trends.vitals).forEach(([key, v]) => {
    if (v.stats.count === 0) return;
    if (v.outOfRange > 0 && v.low !== null) add(v.outOfRange >= 3 ? "high" : "moderate", `${v.label} out of range ${v.outOfRange} time(s)`, `Normal range ${v.low}–${v.high} ${v.unit}; latest ${v.stats.latest} ${v.unit}.`);
    if (v.trend.direction === "rising" && ["systolic", "diastolic", "bloodSugar", "heartRate"].includes(key)) add("moderate", `${v.label} is trending up`, `Average ${v.stats.avg} ${v.unit} over ${days} days (min ${v.stats.min}, max ${v.stats.max}).`);
    if (v.trend.direction === "falling" && key === "weight" && v.stats.count >= 3) add("moderate", "Weight is falling", `From ${v.points[0].value} to ${v.stats.latest} kg. Unintended weight loss is common in dementia — check appetite and nutrition.`);
    if (v.trend.direction === "falling" && key === "oxygenLevel") add("high", "Oxygen level is falling", `Latest ${v.stats.latest}%.`);
  });

  const a = trends.adherence;
  if (a.series.length >= 5) {
    const first = a.series.slice(0, Math.ceil(a.series.length / 2));
    const last = a.series.slice(Math.ceil(a.series.length / 2));
    const avg = (arr) => Math.round(arr.reduce((s, d) => s + (d.percent ?? 0), 0) / Math.max(1, arr.length));
    const delta = avg(last) - avg(first);
    if (delta >= 10) add("low", `Adherence improved by ${delta} points`, `From ${avg(first)}% to ${avg(last)}% over the period.`);
    else if (delta <= -10) add("high", `Adherence dropped by ${Math.abs(delta)} points`, `From ${avg(first)}% to ${avg(last)}%. Review reminders and caregiver support.`);
    else add("low", "Adherence is steady", `Around ${avg(last)}% over the period; weekly rate ${a.weeklyPercent}%.`);
  }
  if (trends.mood.stats.count >= 3 && trends.mood.trend.direction === "falling") add("moderate", "Mood is trending down", `Average mood score ${trends.mood.stats.avg}/5 with a downward trend.`);
  if (trends.cognitive.series.length >= 2 && trends.cognitive.trend.direction === "falling") add("high", "Cognitive scores are declining", `Latest ${trends.cognitive.series.at(-1).percent}% vs ${trends.cognitive.series[0].percent}% at the first assessment.`);

  // Cross-signal: adherence vs blood pressure
  const bp = trends.vitals.systolic;
  if (bp.stats.count >= 3 && a.series.length >= 5 && bp.trend.direction === "rising" && a.trend.direction === "falling") add("high", "Rising blood pressure coincides with falling adherence", "Missed antihypertensive doses may explain the trend.");

  if (insights.length === 0) add("low", "No notable changes", "Vitals, mood and adherence are within their usual ranges.");
  return { days, insights, generatedAt: new Date() };
};

/** Monthly adherence for the last N months + best/worst week + streaks. */
const getPerformance = async (patientUserId, months = 6) => {
  const monthly = [];
  for (let i = months - 1; i >= 0; i--) {
    const r = await adherenceService.getMonthlyReport(patientUserId, i);
    monthly.push({ month: r.month, startDate: r.startDate, totalDoses: r.summary.totalDoses, takenDoses: r.summary.takenDoses, missedDoses: r.summary.missedDoses, adherencePercent: r.summary.monthlyAdherencePercent, weeks: r.weeklyData });
  }
  const weeks = monthly.flatMap((m) => m.weeks.filter((w) => w.total > 0).map((w) => ({ ...w, month: m.month })));
  const best = weeks.slice().sort((a, b) => b.adherencePercent - a.adherencePercent)[0] || null;
  const worst = weeks.slice().sort((a, b) => a.adherencePercent - b.adherencePercent)[0] || null;
  const withData = monthly.filter((m) => m.totalDoses > 0);
  const change = withData.length >= 2 ? withData.at(-1).adherencePercent - withData.at(-2).adherencePercent : null;
  return { months, monthly, bestWeek: best, worstWeek: worst, monthOverMonthChange: change, trend: trendOf(withData.map((m) => m.adherencePercent)) };
};

// ── CSV exports ──────────────────────────────────────────────────────
const csvEscape = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (headers, rows) => [headers.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");

const exportCsv = async (patientUserId, type = "vitals") => {
  if (type === "vitals") {
    const vitals = await Vitals.find({ patientId: patientUserId }).sort({ recordedAt: -1 });
    return { filename: "vitals.csv", csv: toCsv(["Date", "Systolic", "Diastolic", "Heart Rate", "Blood Sugar", "Weight", "Temperature", "Oxygen", "Note"], vitals.map((v) => [v.recordedAt.toISOString(), v.bloodPressure?.systolic, v.bloodPressure?.diastolic, v.heartRate, v.bloodSugar, v.weight, v.temperature, v.oxygenLevel, v.note])) };
  }
  if (type === "medications") {
    const meds = await Medication.find({ userId: patientUserId }).sort({ createdAt: -1 });
    return { filename: "medications.csv", csv: toCsv(["Name", "Dosage", "Frequency", "Times", "Start", "End", "Notes"], meds.map((m) => [m.medicineName, m.dosage, m.frequency, m.timeOfDay.join("|"), m.startDate?.toISOString().slice(0, 10), m.endDate ? m.endDate.toISOString().slice(0, 10) : "ongoing", m.notes])) };
  }
  if (type === "mood") {
    const moods = await MoodTracking.find({ patientUserId }).sort({ date: -1 });
    return { filename: "mood.csv", csv: toCsv(["Date", "Mood", "Energy", "Logged by", "Notes"], moods.map((m) => [m.date.toISOString(), m.mood, m.energyLevel, m.loggedBy, m.notes])) };
  }
  // full: adherence + vitals + medications in one file with section headers
  const adherence = await AdherenceLog.find({ userId: patientUserId }).populate("medicationId", "medicineName dosage").sort({ date: -1 });
  const vitalsCsv = (await exportCsv(patientUserId, "vitals")).csv;
  const medsCsv = (await exportCsv(patientUserId, "medications")).csv;
  const adherenceCsv = toCsv(["Date", "Time of Day", "Medication", "Dosage", "Status", "Confirmed At", "Logged By", "Notes"], adherence.map((l) => [l.date.toISOString().slice(0, 10), l.timeOfDay, l.medicationId?.medicineName, l.medicationId?.dosage, l.status, l.confirmedAt ? l.confirmedAt.toISOString() : "", l.loggedBy, l.notes]));
  return { filename: "health-report.csv", csv: `# Adherence\n${adherenceCsv}\n\n# Vitals\n${vitalsCsv}\n\n# Medications\n${medsCsv}\n` };
};

module.exports = { getHealthTrends, getInsights, getPerformance, exportCsv, trendOf };
