/**
 * MOOD TRACKING MODEL — moodTracking.model.js
 * ===============================================
 * Tracks patient mood and energy levels over time.
 */

const mongoose = require("mongoose");

const moodTrackingSchema = new mongoose.Schema(
  {
    patientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mood: {
      type: String,
      enum: ["happy", "calm", "anxious", "confused", "agitated", "sad", "frustrated", "other"],
      required: true,
    },
    energyLevel: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    loggedBy: {
      type: String,
      enum: ["self", "caregiver"],
      default: "self",
    },
    loggedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

moodTrackingSchema.index({ patientUserId: 1, date: -1 });

module.exports = mongoose.model("MoodTracking", moodTrackingSchema);
