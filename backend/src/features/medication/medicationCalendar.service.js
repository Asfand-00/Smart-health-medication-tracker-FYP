/**
 * MEDICATION CALENDAR SERVICE — medicationCalendar.service.js
 * =============================================================
 * "Calendar-based medication view": for every day of a month, what was
 * scheduled (from active medications) and what happened (from adherence
 * logs / legacy history), so the app can draw a month grid with status
 * colours and a per-day detail list.
 */

const Medication = require("./medication.model");
const AdherenceLog = require("../adherence/adherenceLog.model");
const MedicationHistory = require("./medicationHistory.model");

const TIME_ORDER = { Morning: 0, Afternoon: 1, Evening: 2, Night: 3 };
const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const isActiveOn = (med, day) => {
  const start = new Date(med.startDate);
  start.setHours(0, 0, 0, 0);
  if (day < start) return false;
  if (med.endDate) {
    const end = new Date(med.endDate);
    end.setHours(23, 59, 59, 999);
    if (day > end) return false;
  }
  if (med.frequency === "weekly") {
    return day.getDay() === start.getDay();
  }
  return true;
};

/**
 * @param {string} userId  patient's user id
 * @param {string} month   "YYYY-MM" (defaults to the current month)
 */
const getMonthCalendar = async (userId, month) => {
  const now = new Date();
  const [y, m] = month && /^\d{4}-\d{2}$/.test(month) ? month.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 0, 23, 59, 59, 999);

  const [medications, logs, legacy] = await Promise.all([
    Medication.find({ userId, startDate: { $lte: end }, $or: [{ endDate: null }, { endDate: { $gte: start } }] }),
    AdherenceLog.find({ userId, date: { $gte: start, $lte: end } }).select("medicationId date timeOfDay status confirmedAt"),
    MedicationHistory.find({ userId, date: { $gte: start, $lte: end } }).select("medicationId date timeOfDay status"),
  ]);

  const logKey = (medId, d, t) => `${medId}|${dateKey(new Date(d))}|${t}`;
  const logMap = new Map();
  legacy.forEach((l) => logMap.set(logKey(l.medicationId, l.date, l.timeOfDay), { status: l.status, confirmedAt: null }));
  logs.forEach((l) => logMap.set(logKey(l.medicationId, l.date, l.timeOfDay), { status: l.status, confirmedAt: l.confirmedAt }));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = new Date(d);
    const items = [];
    for (const med of medications) {
      if (!isActiveOn(med, day)) continue;
      for (const t of med.timeOfDay) {
        const log = logMap.get(logKey(med._id, day, t));
        let status = log?.status || "scheduled";
        if (status === "pending") status = day < today ? "missed" : "scheduled";
        if (status === "overdue") status = "missed";
        items.push({ medicationId: med._id, medicineName: med.medicineName, dosage: med.dosage, timeOfDay: t, status, confirmedAt: log?.confirmedAt || null });
      }
    }
    items.sort((a, b) => TIME_ORDER[a.timeOfDay] - TIME_ORDER[b.timeOfDay]);
    const counts = { scheduled: 0, taken: 0, missed: 0, skipped: 0, delayed: 0 };
    items.forEach((i) => {
      if (counts[i.status] !== undefined) counts[i.status] += 1;
    });
    const done = counts.taken + counts.delayed;
    const decided = done + counts.missed + counts.skipped;
    days.push({
      date: dateKey(day),
      isToday: day.getTime() === today.getTime(),
      isPast: day < today,
      total: items.length,
      ...counts,
      adherencePercent: decided > 0 ? Math.round((done / decided) * 100) : null,
      summary: items.length === 0 ? "none" : day > today ? "upcoming" : counts.missed + counts.skipped === 0 && counts.scheduled === 0 ? "complete" : done > 0 ? "partial" : day < today ? "missed" : "pending",
      items,
    });
  }

  const scheduledSoFar = days.filter((d) => !d.summary.match(/upcoming|none/)).reduce((s, d) => s + d.total, 0);
  const takenSoFar = days.reduce((s, d) => s + d.taken + d.delayed, 0);
  return {
    month: `${y}-${String(m).padStart(2, "0")}`,
    startDate: start,
    endDate: end,
    medications: medications.map((mm) => ({ _id: mm._id, medicineName: mm.medicineName, dosage: mm.dosage, timeOfDay: mm.timeOfDay, startDate: mm.startDate, endDate: mm.endDate, frequency: mm.frequency })),
    summary: { scheduled: scheduledSoFar, taken: takenSoFar, missed: days.reduce((s, d) => s + d.missed + d.skipped, 0), adherencePercent: scheduledSoFar > 0 ? Math.round((takenSoFar / scheduledSoFar) * 100) : 0 },
    days,
  };
};

module.exports = { getMonthCalendar };
