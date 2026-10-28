/**
 * REMINDER SCHEDULER — reminderScheduler.js
 * ============================================
 * Background jobs:
 *  every 5 min  generate today's reminders for every patient, escalate overdue ones
 *  every hour   AI preventive alerts (missed-dose predictions, risk flags)
 *  daily        expire prescriptions past their expiry date, refresh risk scores
 *
 * `schedulerState` is exposed to the admin dashboard (system monitoring).
 */

const User = require("../user/user.model");
const Reminder = require("../reminder/reminder.model");
const smartReminderService = require("./smartReminder.service");

const schedulerState = {
  startedAt: null,
  lastTickAt: null,
  lastReminderRunAt: null,
  lastEscalationRunAt: null,
  lastAiRunAt: null,
  lastDailyRunAt: null,
  lastAiResult: null,
  lastError: null,
  remindersGeneratedToday: 0,
};

const initScheduler = (io) => {
  schedulerState.startedAt = new Date();
  console.log("⏰ Smart Reminder Scheduler Initialized.");

  const tick = async () => {
    schedulerState.lastTickAt = new Date();
    try {
      await checkAndGenerateDailyReminders();
      await checkAndEscalateReminders(io);
      schedulerState.lastError = null;
    } catch (err) {
      schedulerState.lastError = err.message;
      console.error("Scheduler Error:", err);
    }
  };

  // First run shortly after boot so a fresh server has today's reminders.
  setTimeout(tick, 10 * 1000);
  setInterval(tick, 1000 * 60 * 5);

  setInterval(async () => {
    try {
      const aiService = require("../ai/ai.service");
      await aiService.updateAlertOutcomes();
      schedulerState.lastAiResult = await aiService.runPreventiveAlerts(io);
      schedulerState.lastAiRunAt = new Date();
    } catch (err) {
      schedulerState.lastError = err.message;
      console.error("AI alert job error:", err.message);
    }
  }, 1000 * 60 * 60);

  setInterval(async () => {
    try {
      await expirePrescriptions();
      await recalculateRiskScores();
      schedulerState.lastDailyRunAt = new Date();
    } catch (err) {
      schedulerState.lastError = err.message;
      console.error("Daily job error:", err.message);
    }
  }, 1000 * 60 * 60 * 24);
};

/** Iterates through all patients and pre-generates today's reminders */
const checkAndGenerateDailyReminders = async () => {
  let generated = 0;
  const patients = await User.find({ role: "patient", isActive: true }).select("_id");
  for (const patient of patients) {
    try {
      const r = await smartReminderService.generateReminders(patient._id);
      generated += r.length;
    } catch (err) {
      console.error(`Reminder generation failed for ${patient._id}:`, err.message);
    }
  }
  schedulerState.lastReminderRunAt = new Date();
  schedulerState.remindersGeneratedToday += generated;
  return { patients: patients.length, generated };
};

/** Checks all active unacknowledged reminders and runs escalation */
const checkAndEscalateReminders = async (io) => {
  const overdueReminders = await Reminder.find({
    reminderType: "medication",
    isRead: false,
    scheduledTime: { $lte: new Date(), $gte: new Date(Date.now() - 1000 * 60 * 60 * 24) },
  }).select("_id");
  let escalated = 0;
  for (const reminder of overdueReminders) {
    try {
      const r = await smartReminderService.escalateReminder(reminder._id, io);
      if (r) escalated += 1;
    } catch (err) {
      console.error(`Escalation failed for ${reminder._id}:`, err.message);
    }
  }
  schedulerState.lastEscalationRunAt = new Date();
  return { checked: overdueReminders.length, escalated };
};

/** Mark prescriptions past their expiry date as expired. */
const expirePrescriptions = async () => {
  const Prescription = require("../prescription/prescription.model");
  const result = await Prescription.updateMany(
    { expiryDate: { $ne: null, $lt: new Date() }, status: { $in: ["pending", "verified"] } },
    { $set: { status: "expired" }, $push: { history: { action: "expired", byRole: "system", note: "Expiry date passed", at: new Date() } } }
  );
  return { expired: result.modifiedCount };
};

/** Refresh stored risk scores so dashboards and reports stay current. */
const recalculateRiskScores = async () => {
  const adherenceService = require("../adherence/adherence.service");
  const patients = await User.find({ role: "patient", isActive: true }).select("_id");
  for (const p of patients) {
    try {
      await adherenceService.calculateRiskScore(p._id);
    } catch (err) {
      console.error(`Risk score failed for ${p._id}:`, err.message);
    }
  }
  return { patients: patients.length };
};

module.exports = {
  initScheduler,
  checkAndGenerateDailyReminders,
  checkAndEscalateReminders,
  expirePrescriptions,
  recalculateRiskScores,
  schedulerState,
};
