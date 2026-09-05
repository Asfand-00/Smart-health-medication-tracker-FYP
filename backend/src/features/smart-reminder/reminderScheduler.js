/**
 * REMINDER SCHEDULER — reminderScheduler.js
 * ============================================
 * Background scheduler to automatically:
 * 1. Generate reminders for all patients daily.
 * 2. Check for overdue reminders and trigger escalations (Level 2/3).
 */

const User = require("../user/user.model");
const Reminder = require("../reminder/reminder.model");
const smartReminderService = require("./smartReminder.service");

// Run scheduler checks
const initScheduler = (io) => {
  console.log("⏰ Smart Reminder Scheduler Initialized.");

  // Check every 5 minutes for escalations and daily generation
  setInterval(async () => {
    try {
      await checkAndGenerateDailyReminders();
      await checkAndEscalateReminders(io);
    } catch (err) {
      console.error("Scheduler Error:", err);
    }
  }, 1000 * 60 * 5); // 5 minutes interval
};

/**
 * Iterates through all patients and pre-generates today's reminders
 */
const checkAndGenerateDailyReminders = async () => {
  try {
    const patients = await User.find({ role: "patient", isActive: true });
    for (const patient of patients) {
      await smartReminderService.generateReminders(patient._id);
    }
  } catch (err) {
    console.error("Error generating daily reminders:", err);
  }
};

/**
 * Checks all active unacknowledged reminders and runs escalation
 */
const checkAndEscalateReminders = async (io) => {
  try {
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - 15); // At least 15 mins old

    // Find medication reminders scheduled in the past today, that are not read/acknowledged
    const overdueReminders = await Reminder.find({
      reminderType: "medication",
      isRead: false,
      scheduledTime: { $lte: new Date(), $gte: new Date(Date.now() - 1000 * 60 * 60 * 24) } // within last 24h
    });

    for (const reminder of overdueReminders) {
      await smartReminderService.escalateReminder(reminder._id, io);
    }
  } catch (err) {
    console.error("Error escalating reminders:", err);
  }
};

module.exports = {
  initScheduler,
  checkAndGenerateDailyReminders
};
