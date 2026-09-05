/**
 * NOTIFICATION MODEL — notification.model.js
 * =============================================
 * Unified notification storage for in-app and email alerts.
 * Supports priority levels and related entity references.
 */

const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "reminder",
        "missed_dose",
        "escalation",
        "caregiver_alert",
        "adherence_update",
        "cognitive_alert",
        "behavioral_alert",
        "mood_update",
        "system",
        "connection_request",
        "medication_update",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      trim: true,
      default: "",
    },
    channel: {
      type: String,
      enum: ["in_app", "email", "both"],
      default: "in_app",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    // Polymorphic reference to related entity
    relatedModel: {
      type: String,
      enum: ["Medication", "Reminder", "AdherenceLog", "CaregiverNote", "CognitiveAssessment", "BehavioralObservation", "MoodTracking"],
      default: null,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "critical"],
      default: "normal",
    },
    // Extra data for the notification
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Who triggered this notification
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
