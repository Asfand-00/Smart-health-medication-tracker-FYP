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
