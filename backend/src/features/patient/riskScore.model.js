/**
 * RISK SCORE MODEL — riskScore.model.js
 * ========================================
 * Computed risk scores derived from adherence,
 * cognitive, and behavioral data.
 */

const mongoose = require("mongoose");

const riskScoreSchema = new mongoose.Schema(
  {
    patientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    overallRisk: {
      type: String,
      enum: ["low", "moderate", "high", "critical"],
      required: true,
    },
    // Individual risk domain scores (0-100)
    adherenceRisk: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    cognitiveRisk: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    behavioralRisk: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    // Composite score
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    // Contributing factors
    factors: [
      {
        factor: String,
        weight: Number,
        description: String,
      },
    ],
    calculatedAt: {
      type: Date,
      default: Date.now,
    },
    calculatedBy: {
      type: String,
      enum: ["system", "manual"],
      default: "system",
    },
  },
  { timestamps: true }
);

riskScoreSchema.index({ patientUserId: 1, calculatedAt: -1 });

module.exports = mongoose.model("RiskScore", riskScoreSchema);
