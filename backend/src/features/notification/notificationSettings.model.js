/**
 * NOTIFICATION SETTINGS MODEL — notificationSettings.model.js
 * =============================================================
 * Per-user alert customisation: which channels, which event types, quiet
 * hours, personal reminder times (adaptive timing) and the phone number used
 * for SMS. Created lazily with defaults the first time it is needed.
 */

const mongoose = require("mongoose");

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const notificationSettingsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
    },
    // Event types the user wants to receive at all
    types: {
      reminder: { type: Boolean, default: true },
      missed_dose: { type: Boolean, default: true },
      escalation: { type: Boolean, default: true },
      adherence_update: { type: Boolean, default: true },
      medication_update: { type: Boolean, default: true },
      mood_update: { type: Boolean, default: true },
      cognitive_alert: { type: Boolean, default: true },
      behavioral_alert: { type: Boolean, default: true },
      ai_alert: { type: Boolean, default: true },
      prescription: { type: Boolean, default: true },
      plan_request: { type: Boolean, default: true },
      doctor_note: { type: Boolean, default: true },
      security: { type: Boolean, default: true },
      system: { type: Boolean, default: true },
      connection_request: { type: Boolean, default: true },
      caregiver_alert: { type: Boolean, default: true },
    },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, default: "22:00", match: TIME_RE },
      end: { type: String, default: "07:00", match: TIME_RE },
    },
    // Personal reminder clock times per slot (adaptive timing applies here)
    reminderTimes: {
      Morning: { type: String, default: "", match: TIME_RE },
      Afternoon: { type: String, default: "", match: TIME_RE },
      Evening: { type: String, default: "", match: TIME_RE },
      Night: { type: String, default: "", match: TIME_RE },
    },
    // Minutes before the scheduled time to pre-notify (0 = at the time)
    reminderLeadMinutes: { type: Number, default: 0, min: 0, max: 120 },
    voiceAlerts: { type: Boolean, default: true },
    smsPhone: { type: String, trim: true, default: "" },
    dailySummaryEmail: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSettingsSchema.statics.getOrCreate = async function (userId) {
  let doc = await this.findOne({ userId });
  if (!doc) doc = await this.create({ userId });
  return doc;
};

/** True when `date` falls inside the user's quiet hours window. */
notificationSettingsSchema.methods.isQuietNow = function (date = new Date()) {
  if (!this.quietHours?.enabled) return false;
  const [sh, sm] = this.quietHours.start.split(":").map(Number);
  const [eh, em] = this.quietHours.end.split(":").map(Number);
  const now = date.getHours() * 60 + date.getMinutes();
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return start <= end ? now >= start && now < end : now >= start || now < end;
};

module.exports = mongoose.model("NotificationSettings", notificationSettingsSchema);
