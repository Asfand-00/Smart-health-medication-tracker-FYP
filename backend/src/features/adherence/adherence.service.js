/**
 * ADHERENCE SERVICE — adherence.service.js
 * ==========================================
 * Business logic for medication adherence tracking,
 * daily/weekly/monthly reports, risk scoring, and predictions.
 */

const AdherenceLog = require("./adherenceLog.model");
const ReminderHistory = require("./reminderHistory.model");
const Medication = require("../medication/medication.model");
const MedicationHistory = require("../medication/medicationHistory.model");
const Patient = require("../patient/patient.model");
const RiskScore = require("../patient/riskScore.model");
const CognitiveAssessment = require("../patient/cognitiveAssessment.model");
const BehavioralObservation = require("../patient/behavioralObservation.model");

// ── Helper: get start/end of day ──────────────────────────────────
const getDayBounds = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// ── Confirm a dose ──────────────────────────────────────────────
const confirmDose = async ({ userId, patientId, medicationId, date, timeOfDay, status, notes, loggedBy, loggedByUserId }) => {
  const logDate = new Date(date);
  logDate.setHours(0, 0, 0, 0);

  // Upsert: update if exists, create if not
  const filter = { userId, medicationId, date: logDate, timeOfDay };
  const update = {
    userId,
    patientId,
    medicationId,
    date: logDate,
    timeOfDay,
    status,
    confirmedAt: status === "taken" ? new Date() : null,
    delayMinutes: status === "delayed" ? calculateDelay(timeOfDay) : 0,
    loggedBy: loggedBy || "self",
    loggedByUserId: loggedByUserId || null,
    notes: notes || "",
  };

  const log = await AdherenceLog.findOneAndUpdate(filter, update, {
    new: true,
    upsert: true,
    runValidators: true,
  });

  // Also update legacy MedicationHistory for backward compatibility
  const legacyStatus = status === "delayed" ? "taken" : status === "skipped" ? "missed" : status;
  await MedicationHistory.findOneAndUpdate(
    { medicationId, userId, date: logDate, timeOfDay },
    { medicationId, userId, patientId, date: logDate, timeOfDay, status: legacyStatus },
    { upsert: true, new: true }
  );

  // Mark corresponding reminders for today as read/completed
  try {
    const Reminder = require("../reminder/reminder.model");
    const startOfDay = new Date(logDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(logDate);
    endOfDay.setHours(23, 59, 59, 999);

    await Reminder.updateMany(
      {
        patientUserId: userId,
        medicationId,
        scheduledTime: { $gte: startOfDay, $lte: endOfDay },
        title: { $regex: timeOfDay, $options: "i" }
      },
      { isRead: true }
    );
  } catch (remErr) {
    console.log("Error marking reminders as read inside confirmDose:", remErr.message);
  }

  return log;
};

// ── Calculate delay in minutes from expected time ───────────────
const calculateDelay = (timeOfDay) => {
  const now = new Date();
  const hours = now.getHours();
  const expectedHours = { Morning: 8, Afternoon: 13, Evening: 18, Night: 21 };
  const expected = expectedHours[timeOfDay] || 8;
  return Math.max(0, (hours - expected) * 60 + now.getMinutes());
};

// ── Get today's adherence status ────────────────────────────────
const getTodayStatus = async (userId) => {
  const { start, end } = getDayBounds();
  const expectedHours = { Morning: 8, Afternoon: 13, Evening: 18, Night: 21 };
  
  const medications = await Medication.find({ userId });
  const logs = await AdherenceLog.find({
    userId,
    date: { $gte: start, $lte: end },
  }).populate("medicationId", "medicineName dosage timeOfDay");

  // Build a schedule of what's expected vs what's done
  const schedule = [];
  const timeOrder = { Morning: 0, Afternoon: 1, Evening: 2, Night: 3 };

  for (const med of medications) {
    // Check if medication is active today
    const medStart = new Date(med.startDate);
    medStart.setHours(0, 0, 0, 0);
    if (start < medStart) continue;
    if (med.endDate) {
      const medEnd = new Date(med.endDate);
      medEnd.setHours(23, 59, 59, 999);
      if (start > medEnd) continue;
    }

    for (const time of med.timeOfDay) {
      const log = logs.find(
        (l) => l.medicationId?._id?.toString() === med._id.toString() && l.timeOfDay === time
      );
      
      let status = log ? log.status : "pending";
      if (status === "pending") {
        const expectedHour = expectedHours[time] || 8;
        const limitTime = new Date();
        limitTime.setHours(expectedHour, 30, 0, 0); // 30 mins grace period
        if (new Date() > limitTime) {
          status = "missed";
        }
      }

      schedule.push({
        medicationId: med._id,
        medicineName: med.medicineName,
        dosage: med.dosage,
        timeOfDay: time,
        timeOrder: timeOrder[time],
        status,
        confirmedAt: log?.confirmedAt || null,
        logId: log?._id || null,
      });
    }
  }

  schedule.sort((a, b) => a.timeOrder - b.timeOrder);

  const total = schedule.length;
  const taken = schedule.filter((s) => s.status === "taken").length;
  const missed = schedule.filter((s) => s.status === "missed").length;
  const skipped = schedule.filter((s) => s.status === "skipped").length;
  const delayed = schedule.filter((s) => s.status === "delayed").length;
  const pending = schedule.filter((s) => s.status === "pending").length;
  const completedCount = taken + delayed;
  const adherencePercent = total > 0 ? Math.round((completedCount / total) * 100) : 100;

  return { schedule, total, taken, missed, skipped, delayed, pending, adherencePercent };
};

// ── Daily adherence report ──────────────────────────────────────
const getDailyReport = async (userId, dateStr) => {
  const { start, end } = getDayBounds(dateStr);

  const logs = await AdherenceLog.find({
    userId,
    date: { $gte: start, $lte: end },
  }).populate("medicationId", "medicineName dosage");

  const now = new Date();
  const processedLogs = logs.map(l => {
    let status = l.status;
    if (status === "pending") {
      const scheduledDate = l.scheduledTime ? new Date(l.scheduledTime) : new Date(l.date);
      if (!l.scheduledTime) {
        const expectedHours = { Morning: 8, Afternoon: 13, Evening: 18, Night: 21 };
        const expectedHour = expectedHours[l.timeOfDay] || 8;
        scheduledDate.setHours(expectedHour, 30, 0, 0);
      }
      if (scheduledDate < now) {
        status = "missed";
      }
    }
    return { ...l.toObject(), status };
  });

  const taken = processedLogs.filter((l) => l.status === "taken").length;
  const missed = processedLogs.filter((l) => l.status === "missed").length;
  const skipped = processedLogs.filter((l) => l.status === "skipped").length;
  const delayed = processedLogs.filter((l) => l.status === "delayed").length;
  const total = processedLogs.length;
  const completedCount = taken + delayed;
  const completionPercent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return {
    date: start,
    logs: processedLogs,
    summary: { total, taken, missed, skipped, delayed, completionPercent },
  };
};

// ── Weekly adherence report ─────────────────────────────────────
const getWeeklyReport = async (userId, weeksBack = 0) => {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() - weeksBack * 7);
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6);
  startDate.setHours(0, 0, 0, 0);

  const logs = await AdherenceLog.find({
    userId,
    date: { $gte: startDate, $lte: endDate },
  });

  const processedLogs = logs.map(l => {
    let status = l.status;
    if (status === "pending") {
      const scheduledDate = l.scheduledTime ? new Date(l.scheduledTime) : new Date(l.date);
      if (!l.scheduledTime) {
        const expectedHours = { Morning: 8, Afternoon: 13, Evening: 18, Night: 21 };
        const expectedHour = expectedHours[l.timeOfDay] || 8;
        scheduledDate.setHours(expectedHour, 30, 0, 0);
      }
      if (scheduledDate < now) {
        status = "missed";
      }
    }
    return { ...l.toObject(), status };
  });

  // Group by day
  const dailyData = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);

    const dayLogs = processedLogs.filter((l) => l.date >= dayStart && l.date <= dayEnd);
    const taken = dayLogs.filter((l) => l.status === "taken" || l.status === "delayed").length;
    const total = dayLogs.length;

    dailyData.push({
      date: dayStart.toISOString().split("T")[0],
      dayName: dayStart.toLocaleDateString("en-US", { weekday: "short" }),
      taken,
      missed: dayLogs.filter((l) => l.status === "missed").length,
      skipped: dayLogs.filter((l) => l.status === "skipped").length,
      total,
      adherencePercent: total > 0 ? Math.round((taken / total) * 100) : 0,
    });
  }

  const totalAll = processedLogs.length;
  const takenAll = processedLogs.filter((l) => l.status === "taken" || l.status === "delayed").length;

  return {
    startDate,
    endDate,
    dailyData,
    summary: {
      totalDoses: totalAll,
      takenDoses: takenAll,
      missedDoses: processedLogs.filter((l) => l.status === "missed").length,
      weeklyAdherencePercent: totalAll > 0 ? Math.round((takenAll / totalAll) * 100) : 0,
    },
  };
};

// ── Monthly adherence report ────────────────────────────────────
const getMonthlyReport = async (userId, monthsBack = 0) => {
  const now = new Date();
  const targetMonth = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const startDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
  const endDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59, 999);

  const logs = await AdherenceLog.find({
    userId,
    date: { $gte: startDate, $lte: endDate },
  });

  const processedLogs = logs.map(l => {
    let status = l.status;
    if (status === "pending") {
      const scheduledDate = l.scheduledTime ? new Date(l.scheduledTime) : new Date(l.date);
      if (!l.scheduledTime) {
        const expectedHours = { Morning: 8, Afternoon: 13, Evening: 18, Night: 21 };
        const expectedHour = expectedHours[l.timeOfDay] || 8;
        scheduledDate.setHours(expectedHour, 30, 0, 0);
      }
      if (scheduledDate < now) {
        status = "missed";
      }
    }
    return { ...l.toObject(), status };
  });

  // Group by week
  const weeklyData = [];
  let weekStart = new Date(startDate);
  let weekNum = 1;
  while (weekStart <= endDate) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (weekEnd > endDate) weekEnd.setTime(endDate.getTime());

    const weekLogs = processedLogs.filter((l) => l.date >= weekStart && l.date <= weekEnd);
    const taken = weekLogs.filter((l) => l.status === "taken" || l.status === "delayed").length;
    const total = weekLogs.length;

    weeklyData.push({
      week: weekNum,
      startDate: weekStart.toISOString().split("T")[0],
      taken,
      missed: weekLogs.filter((l) => l.status === "missed").length,
      total,
      adherencePercent: total > 0 ? Math.round((taken / total) * 100) : 0,
    });

    weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() + 1);
    weekNum++;
  }

  const totalAll = processedLogs.length;
  const takenAll = processedLogs.filter((l) => l.status === "taken" || l.status === "delayed").length;

  return {
    month: startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    startDate,
    endDate,
    weeklyData,
    summary: {
      totalDoses: totalAll,
      takenDoses: takenAll,
      missedDoses: processedLogs.filter((l) => l.status === "missed").length,
      monthlyAdherencePercent: totalAll > 0 ? Math.round((takenAll / totalAll) * 100) : 0,
    },
  };
};

// ── History with search/filter ──────────────────────────────────
const getHistory = async (userId, { startDate, endDate, medicationId, status, page = 1, limit = 20 }) => {
  const query = { userId };
  if (startDate && endDate) {
    query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }
  if (medicationId) query.medicationId = medicationId;
  if (status) query.status = status;

  const total = await AdherenceLog.countDocuments(query);
  const logs = await AdherenceLog.find(query)
    .populate("medicationId", "medicineName dosage timeOfDay")
    .sort({ date: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
};

// ── Calculate risk score ────────────────────────────────────────
const calculateRiskScore = async (patientUserId) => {
  // Adherence risk (based on last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const recentLogs = await AdherenceLog.find({
    userId: patientUserId,
    date: { $gte: weekAgo },
  });

  const totalRecent = recentLogs.length;
  const missedRecent = recentLogs.filter((l) => l.status === "missed").length;
  const adherenceRisk = totalRecent > 0 ? Math.round((missedRecent / totalRecent) * 100) : 0;

  // Cognitive risk (based on latest assessment)
  const latestAssessment = await CognitiveAssessment.findOne({ patientUserId })
    .sort({ assessmentDate: -1 });
  const cognitiveRisk = latestAssessment
    ? Math.round(100 - (latestAssessment.score / latestAssessment.maxScore) * 100)
    : 0;

  // Behavioral risk (based on recent observations)
  const recentObs = await BehavioralObservation.find({
    patientUserId,
    observedAt: { $gte: weekAgo },
  });
  const severeObs = recentObs.filter((o) => o.severity === "severe" || o.severity === "critical").length;
  const behavioralRisk = Math.min(100, severeObs * 25);

  // Composite score
  const score = Math.round(adherenceRisk * 0.4 + cognitiveRisk * 0.35 + behavioralRisk * 0.25);
  const overallRisk = score >= 75 ? "critical" : score >= 50 ? "high" : score >= 25 ? "moderate" : "low";

  const factors = [];
  if (adherenceRisk > 30) factors.push({ factor: "Low medication adherence", weight: 0.4, description: `${missedRecent} missed doses in 7 days` });
  if (cognitiveRisk > 40) factors.push({ factor: "Cognitive decline", weight: 0.35, description: `Latest assessment score: ${latestAssessment?.score}/${latestAssessment?.maxScore}` });
  if (behavioralRisk > 30) factors.push({ factor: "Behavioral concerns", weight: 0.25, description: `${severeObs} severe observations in 7 days` });

  // Save to DB
  const riskScore = await RiskScore.findOneAndUpdate(
    { patientUserId },
    { patientUserId, overallRisk, adherenceRisk, cognitiveRisk, behavioralRisk, score, factors, calculatedAt: new Date() },
    { upsert: true, new: true }
  );

  return riskScore;
};

// ── Adherence prediction ────────────────────────────────────────
const getAdherencePrediction = async (patientUserId) => {
  // Analyze last 30 days trend
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const logs = await AdherenceLog.find({
    userId: patientUserId,
    date: { $gte: thirtyDaysAgo },
  });

  // Weekly breakdown
  const weeks = [[], [], [], []];
  logs.forEach((log) => {
    const daysAgo = Math.floor((Date.now() - log.date.getTime()) / (1000 * 60 * 60 * 24));
    const weekIndex = Math.min(3, Math.floor(daysAgo / 7));
    weeks[3 - weekIndex].push(log);
  });

  const weeklyRates = weeks.map((weekLogs) => {
    const total = weekLogs.length;
    const taken = weekLogs.filter((l) => l.status === "taken" || l.status === "delayed").length;
    return total > 0 ? Math.round((taken / total) * 100) : null;
  }).filter(r => r !== null);

  // Simple linear trend
  let trend = "stable";
  if (weeklyRates.length >= 2) {
    const recent = weeklyRates[weeklyRates.length - 1];
    const older = weeklyRates[0];
    if (recent - older > 10) trend = "improving";
    else if (older - recent > 10) trend = "declining";
  }

  // Missed dose patterns
  const missedByTime = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
  logs.filter((l) => l.status === "missed").forEach((l) => {
    if (missedByTime[l.timeOfDay] !== undefined) missedByTime[l.timeOfDay]++;
  });

  const mostMissedTime = Object.entries(missedByTime).sort((a, b) => b[1] - a[1])[0];

  return {
    weeklyRates,
    trend,
    missedByTime,
    riskTime: mostMissedTime[1] > 0 ? mostMissedTime[0] : null,
    prediction: trend === "declining" ? "Patient may need increased monitoring" :
                trend === "improving" ? "Patient adherence is improving" :
                "Patient adherence is stable",
  };
};

// ── Missed-dose pattern analysis ────────────────────────────────
const getMissedDosePatterns = async (patientUserId) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const missedLogs = await AdherenceLog.find({
    userId: patientUserId,
    status: "missed",
    date: { $gte: thirtyDaysAgo },
  }).populate("medicationId", "medicineName");

  // Pattern by time of day
  const byTimeOfDay = {};
  // Pattern by day of week
  const byDayOfWeek = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
  // Pattern by medication
  const byMedication = {};

  missedLogs.forEach((log) => {
    // By time
    byTimeOfDay[log.timeOfDay] = (byTimeOfDay[log.timeOfDay] || 0) + 1;
    // By day
    const dayName = log.date.toLocaleDateString("en-US", { weekday: "short" });
    if (byDayOfWeek[dayName] !== undefined) byDayOfWeek[dayName]++;
    // By medication
    const medName = log.medicationId?.medicineName || "Unknown";
    byMedication[medName] = (byMedication[medName] || 0) + 1;
  });

  return {
    totalMissed: missedLogs.length,
    byTimeOfDay,
    byDayOfWeek,
    byMedication,
    mostMissedTime: Object.entries(byTimeOfDay).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    mostMissedDay: Object.entries(byDayOfWeek).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
  };
};

// ── Export adherence data ───────────────────────────────────────
const exportData = async (userId, { startDate, endDate, format = "json" }) => {
  const query = { userId };
  if (startDate && endDate) {
    query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const logs = await AdherenceLog.find(query)
    .populate("medicationId", "medicineName dosage")
    .sort({ date: -1 });

  if (format === "csv") {
    const headers = "Date,Time of Day,Medication,Dosage,Status,Confirmed At,Logged By,Notes\n";
    const rows = logs.map((l) =>
      `${l.date.toISOString().split("T")[0]},${l.timeOfDay},${l.medicationId?.medicineName || "N/A"},${l.medicationId?.dosage || "N/A"},${l.status},${l.confirmedAt ? l.confirmedAt.toISOString() : "N/A"},${l.loggedBy || "self"},${l.notes || ""}`
    ).join("\n");
    return headers + rows;
  }

  return logs;
};

module.exports = {
  confirmDose,
  getTodayStatus,
  getDailyReport,
  getWeeklyReport,
  getMonthlyReport,
  getHistory,
  calculateRiskScore,
  getAdherencePrediction,
  getMissedDosePatterns,
  exportData,
};
