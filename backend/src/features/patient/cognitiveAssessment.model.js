/**
 * COGNITIVE ASSESSMENT MODEL — cognitiveAssessment.model.js
 * ===========================================================
 * Logs cognitive assessments for Alzheimer's patients.
 * Tracks memory, orientation, language, and attention scores.
 */

const mongoose = require("mongoose");

const cognitiveAssessmentSchema = new mongoose.Schema(
  {
    patientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assessedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assessedByRole: {
      type: String,
      enum: ["caregiver", "doctor"],
      required: true,
    },
    assessmentType: {
      type: String,
      enum: ["mini_mental", "clock_drawing", "verbal_fluency", "memory_recall", "general", "daily_check"],
      default: "general",
    },
    // Individual domain scores (0-10 each)
    memoryScore: {
      type: Number,
      min: 0,
      max: 10,
      default: null,
    },
    orientationScore: {
      type: Number,
      min: 0,
      max: 10,
      default: null,
    },
    languageScore: {
      type: Number,
      min: 0,
      max: 10,
      default: null,
    },
    attentionScore: {
      type: Number,
      min: 0,
      max: 10,
      default: null,
    },
    // Overall composite score
    score: {
      type: Number,
      min: 0,
      max: 40,
      default: null,
    },
    maxScore: {
      type: Number,
      default: 40,
    },
    observations: {
      type: String,
      trim: true,
      default: "",
    },
    recommendations: {
      type: String,
      trim: true,
      default: "",
    },
    assessmentDate: {
      type: Date,
      default: Date.now,
    },
    // Decline tracking
    declineFromPrevious: {
      type: Number, // percentage change
      default: null,
    },
  },
  { timestamps: true }
);

cognitiveAssessmentSchema.index({ patientUserId: 1, assessmentDate: -1 });

module.exports = mongoose.model("CognitiveAssessment", cognitiveAssessmentSchema);
