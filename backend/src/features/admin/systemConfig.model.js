/**
 * SYSTEM CONFIG MODEL — systemConfig.model.js
 * =============================================
 * A single document holding platform-wide settings an administrator can
 * change at runtime (Admin Panel → "Platform configuration settings").
 * Read through `getConfig()`, which caches for 30 seconds so the reminder
 * scheduler and middleware do not hit the database on every call.
 */

const mongoose = require("mongoose");

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const systemConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: "global", unique: true },
    appName: { type: String, default: "Smart Medication Health Tracker" },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: "The system is under maintenance. Please try again shortly." },
    allowRegistration: { type: Boolean, default: true },
    registrationRoles: { type: [String], default: ["patient", "caregiver", "doctor"] },
    // Default reminder clock times (users can override in their own settings)
    reminderTimes: {
      Morning: { type: String, default: "08:00", match: TIME_RE },
      Afternoon: { type: String, default: "13:00", match: TIME_RE },
      Evening: { type: String, default: "18:00", match: TIME_RE },
      Night: { type: String, default: "21:00", match: TIME_RE },
    },
    gracePeriodMinutes: { type: Number, default: 30, min: 0, max: 240 },
    escalation: {
      level2Minutes: { type: Number, default: 15, min: 1, max: 240 },
      level3Minutes: { type: Number, default: 30, min: 1, max: 480 },
    },
    ai: {
      enabled: { type: Boolean, default: true },
      alertThreshold: { type: Number, default: 0.6, min: 0.1, max: 0.95 },
      caregiverAlertThreshold: { type: Number, default: 0.75, min: 0.1, max: 0.99 },
      lookbackDays: { type: Number, default: 30, min: 7, max: 180 },
    },
    channels: {
      emailEnabled: { type: Boolean, default: true },
      smsEnabled: { type: Boolean, default: true },
      pushEnabled: { type: Boolean, default: true },
    },
    security: {
      maxLoginAttempts: { type: Number, default: 5, min: 3, max: 20 },
      lockoutMinutes: { type: Number, default: 15, min: 1, max: 1440 },
      passwordMinLength: { type: Number, default: 6, min: 6, max: 64 },
      passwordRequireNumber: { type: Boolean, default: true },
      sessionDays: { type: Number, default: 7, min: 1, max: 90 },
      otpExpiryMinutes: { type: Number, default: 15, min: 5, max: 60 },
    },
    prescriptions: {
      maxFileSizeMb: { type: Number, default: 10, min: 1, max: 25 },
      requireDoctorVerification: { type: Boolean, default: true },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

let cache = { doc: null, at: 0 };
const TTL_MS = 30 * 1000;

systemConfigSchema.statics.getConfig = async function (fresh = false) {
  if (!fresh && cache.doc && Date.now() - cache.at < TTL_MS) return cache.doc;
  let doc = await this.findOne({ key: "global" });
  if (!doc) doc = await this.create({ key: "global" });
  cache = { doc, at: Date.now() };
  return doc;
};

systemConfigSchema.statics.invalidateCache = function () {
  cache = { doc: null, at: 0 };
};

module.exports = mongoose.model("SystemConfig", systemConfigSchema);
