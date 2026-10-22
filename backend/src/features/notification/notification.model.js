/**
 * NOTIFICATION MODEL — notification.model.js
 * =============================================
 * Unified notification storage for in-app, email, push and SMS alerts.
 * `deliveries` records what happened on each channel so the notification
 * history can show "email sent", "push skipped (quiet hours)", etc.
 */

const mongoose = require("mongoose");

const NOTIFICATION_TYPES = [
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
  "ai_alert",
  "prescription",
  "plan_request",
  "doctor_note",
  "security",
];

const deliverySchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ["in_app", "email", "push", "sms", "voice"], required: true },
    status: { type: String, enum: ["sent", "skipped", "failed", "mock"], required: true },
    detail: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, trim: true, default: "" },
    // Requested channel: in_app | email | both (in-app + email) | all (every channel the user allows)
    channel: { type: String, enum: ["in_app", "email", "both", "all"], default: "in_app" },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    relatedModel: {
      type: String,
      enum: [
        "Medication",
        "Reminder",
        "AdherenceLog",
        "CaregiverNote",
        "CognitiveAssessment",
        "BehavioralObservation",
        "MoodTracking",
        "Prescription",
        "MedicationPlanRequest",
        "DoctorNote",
        "AiAlert",
        "User",
      ],
      default: null,
    },
    relatedId: { type: mongoose.Schema.Types.ObjectId, default: null },
    priority: { type: String, enum: ["low", "normal", "high", "critical"], default: "normal" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deliveries: { type: [deliverySchema], default: [] },
    // Set when an admin broadcast created this notification
    broadcastId: { type: String, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);
Notification.TYPES = NOTIFICATION_TYPES;

module.exports = Notification;
