/**
 * REMINDER HISTORY MODEL — reminderHistory.model.js
 * ====================================================
 * Logs every reminder that was fired for analytics
 * and adaptive timing optimization.
 */

const mongoose = require("mongoose");

const reminderHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    medicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medication",
      default: null,
    },
    reminderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reminder",
      default: null,
    },
    scheduledTime: {
      type: Date,
      required: true,
    },
    firedAt: {
      type: Date,
      default: Date.now,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    // Time in seconds between fire and acknowledgment
    responseTime: {
      type: Number,
      default: null,
    },
    wasEffective: {
      type: Boolean,
      default: false,
    },
    channel: {
      type: String,
      enum: ["in_app", "email", "push", "voice"],
      default: "in_app",
    },
    // Which attempt this was in the escalation chain
    attempt: {
      type: Number,
      default: 1,
      min: 1,
      max: 3,
    },
    timeOfDay: {
      type: String,
      enum: ["Morning", "Afternoon", "Evening", "Night"],
    },
  },
  { timestamps: true }
);

reminderHistorySchema.index({ userId: 1, scheduledTime: -1 });
reminderHistorySchema.index({ medicationId: 1, scheduledTime: -1 });

module.exports = mongoose.model("ReminderHistory", reminderHistorySchema);
