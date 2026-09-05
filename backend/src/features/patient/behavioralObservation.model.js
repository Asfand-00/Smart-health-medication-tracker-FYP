/**
 * BEHAVIORAL OBSERVATION MODEL — behavioralObservation.model.js
 * ================================================================
 * Logs behavioral observations for Alzheimer's patients.
 * Tracks wandering, confusion, agitation, mood changes, etc.
 */

const mongoose = require("mongoose");

const behavioralObservationSchema = new mongoose.Schema(
  {
    patientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    observedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    observationType: {
      type: String,
      enum: [
        "wandering",
        "confusion",
        "agitation",
        "mood_change",
        "medication_confusion",
        "sleep_disturbance",
        "appetite_change",
        "social_withdrawal",
        "repetitive_behavior",
        "safety_concern",
        "other",
      ],
      required: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    severity: {
      type: String,
      enum: ["mild", "moderate", "severe", "critical"],
      default: "mild",
    },
    location: {
      type: String,
      trim: true,
      default: "",
    },
    // Duration in minutes
    duration: {
      type: Number,
      default: null,
    },
    triggers: {
      type: [String],
      default: [],
    },
    actionsTaken: {
      type: String,
      trim: true,
      default: "",
    },
    requiresFollowUp: {
      type: Boolean,
      default: false,
    },
    followUpNotes: {
      type: String,
      trim: true,
      default: "",
    },
    observedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

behavioralObservationSchema.index({ patientUserId: 1, observedAt: -1 });
behavioralObservationSchema.index({ patientUserId: 1, observationType: 1 });

module.exports = mongoose.model("BehavioralObservation", behavioralObservationSchema);
