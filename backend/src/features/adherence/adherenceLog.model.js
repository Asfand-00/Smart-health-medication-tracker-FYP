/**
 * ADHERENCE LOG MODEL — adherenceLog.model.js
 * ==============================================
 * Tracks every medication dose event with detailed status,
 * timestamps, escalation tracking, and caregiver attribution.
 */

const mongoose = require("mongoose");

const adherenceLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    medicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medication",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    timeOfDay: {
      type: String,
      enum: ["Morning", "Afternoon", "Evening", "Night"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "taken", "missed", "skipped", "delayed", "overdue"],
      required: true,
    },
    scheduledTime: {
      type: Date,
      default: null,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    delayMinutes: {
      type: Number,
      default: 0,
    },
    // Escalation: 0=none, 1=first reminder, 2=second reminder, 3=caregiver notified
    escalationLevel: {
      type: Number,
      default: 0,
      min: 0,
      max: 3,
    },
    caregiverNotified: {
      type: Boolean,
      default: false,
    },
    loggedBy: {
      type: String,
      enum: ["self", "caregiver", "system"],
      default: "self",
    },
    loggedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

// Compound indexes for fast queries
adherenceLogSchema.index({ userId: 1, date: -1 });
adherenceLogSchema.index({ medicationId: 1, date: -1 });
adherenceLogSchema.index({ patientId: 1, date: -1 });
adherenceLogSchema.index({ userId: 1, medicationId: 1, date: 1, timeOfDay: 1 }, { unique: true });

module.exports = mongoose.model("AdherenceLog", adherenceLogSchema);
