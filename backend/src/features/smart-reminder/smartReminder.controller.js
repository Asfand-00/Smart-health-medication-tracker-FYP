/**
 * SMART REMINDER CONTROLLER — smartReminder.controller.js
 * ========================================================
 * HTTP route handlers for the Smart Reminder System.
 */

const smartReminderService = require("./smartReminder.service");

// POST /api/smart-reminders/generate — Auto-generate reminders from medications
exports.generateReminders = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const reminders = await smartReminderService.generateReminders(userId);
    res.status(200).json({ success: true, message: `Generated ${reminders.length} reminders for today.`, data: reminders });
  } catch (error) {
    next(error);
  }
};

// GET /api/smart-reminders/upcoming — Get upcoming reminders for today
exports.getUpcomingReminders = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const reminders = await smartReminderService.getUpcomingReminders(userId);
    res.status(200).json({ success: true, data: reminders });
  } catch (error) {
    next(error);
  }
};

// POST /api/smart-reminders/acknowledge/:id — Acknowledge reminder (one-tap)
exports.acknowledgeReminder = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const reminderId = req.params.id;
    const { status, notes } = req.body;

    if (!status || !["taken", "skipped", "delayed"].includes(status)) {
      return res.status(400).json({ success: false, message: "Valid status (taken, skipped, delayed) is required." });
    }

    // Pass io for real-time socket events
    const io = req.app.locals.io;

    const result = await smartReminderService.acknowledgeReminder(reminderId, userId, { status, notes }, io);
    res.status(200).json({ success: true, message: `Medication marked as ${status}`, data: result });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/smart-reminders/history — Reminder history
exports.getReminderHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const history = await smartReminderService.getReminderHistory(userId);
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};

// GET /api/smart-reminders/suggestions — Adaptive timing suggestions
exports.getSuggestions = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const suggestions = await smartReminderService.getAdaptiveSuggestions(userId);
    res.status(200).json({ success: true, data: suggestions });
  } catch (error) {
    next(error);
  }
};

// POST /api/smart-reminders/escalate/:id — Trigger escalation workflow
exports.escalateReminder = async (req, res, next) => {
  try {
    const reminderId = req.params.id;
    const io = req.app.locals.io;
    const result = await smartReminderService.escalateReminder(reminderId, io);
    res.status(200).json({ success: true, message: "Escalation checked/run", data: result });
  } catch (error) {
    next(error);
  }
};

// GET /api/smart-reminders/missed — Get unacknowledged reminders
exports.getMissedReminders = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const reminders = await smartReminderService.getMissedReminders(userId);
    res.status(200).json({ success: true, data: reminders });
  } catch (error) {
    next(error);
  }
};

// ── Reminder time preferences ────────────────────────────────────────
const NotificationSettings = require("../notification/notificationSettings.model");
const Reminder = require("../reminder/reminder.model");

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// GET /api/smart-reminders/preferences
exports.getPreferences = async (req, res, next) => {
  try {
    const settings = await NotificationSettings.getOrCreate(req.user._id);
    const effective = await smartReminderService.resolveSlotTimes(req.user._id);
    res.status(200).json({ success: true, data: { reminderTimes: settings.reminderTimes, reminderLeadMinutes: settings.reminderLeadMinutes, voiceAlerts: settings.voiceAlerts, effective } });
  } catch (error) {
    next(error);
  }
};

/** Re-time today's still-unacknowledged reminders after a preference change. */
const rescheduleToday = async (userId) => {
  const slotTimes = await smartReminderService.resolveSlotTimes(userId);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const reminders = await Reminder.find({ patientUserId: userId, reminderType: "medication", isRead: false, scheduledTime: { $gte: start, $lte: end } });
  for (const r of reminders) {
    const slot = Object.keys(slotTimes).find((k) => r.title.toLowerCase().includes(k.toLowerCase()));
    if (!slot) continue;
    const t = new Date(start);
    t.setHours(slotTimes[slot].hour, slotTimes[slot].minute, 0, 0);
    if (t.getTime() !== new Date(r.scheduledTime).getTime()) {
      r.scheduledTime = t;
      await r.save();
    }
  }
  return reminders.length;
};

// PUT /api/smart-reminders/preferences  { reminderTimes: {Morning:'08:30',...}, reminderLeadMinutes, voiceAlerts }
exports.updatePreferences = async (req, res, next) => {
  try {
    const settings = await NotificationSettings.getOrCreate(req.user._id);
    const { reminderTimes, reminderLeadMinutes, voiceAlerts } = req.body || {};
    if (reminderTimes && typeof reminderTimes === "object") {
      for (const slot of ["Morning", "Afternoon", "Evening", "Night"]) {
        if (reminderTimes[slot] !== undefined) {
          if (!TIME_RE.test(reminderTimes[slot])) return res.status(400).json({ success: false, message: `${slot} time must be HH:MM (24h).` });
          settings.reminderTimes[slot] = reminderTimes[slot];
        }
      }
    }
    if (reminderLeadMinutes !== undefined) settings.reminderLeadMinutes = Math.max(0, Math.min(120, Number(reminderLeadMinutes) || 0));
    if (voiceAlerts !== undefined) settings.voiceAlerts = Boolean(voiceAlerts);
    await settings.save();
    const rescheduled = await rescheduleToday(req.user._id);
    res.status(200).json({ success: true, message: "Reminder preferences saved.", data: { reminderTimes: settings.reminderTimes, reminderLeadMinutes: settings.reminderLeadMinutes, voiceAlerts: settings.voiceAlerts, rescheduledToday: rescheduled } });
  } catch (error) {
    next(error);
  }
};

// POST /api/smart-reminders/suggestions/apply  { timeOfDay, suggestedTime }
exports.applySuggestion = async (req, res, next) => {
  try {
    const { timeOfDay, suggestedTime } = req.body || {};
    if (!["Morning", "Afternoon", "Evening", "Night"].includes(timeOfDay) || !TIME_RE.test(suggestedTime || "")) {
      return res.status(400).json({ success: false, message: "timeOfDay and suggestedTime (HH:MM) are required." });
    }
    const settings = await NotificationSettings.getOrCreate(req.user._id);
    settings.reminderTimes[timeOfDay] = suggestedTime;
    await settings.save();
    const rescheduled = await rescheduleToday(req.user._id);
    res.status(200).json({ success: true, message: `${timeOfDay} reminder moved to ${suggestedTime}.`, data: { reminderTimes: settings.reminderTimes, rescheduledToday: rescheduled } });
  } catch (error) {
    next(error);
  }
};
