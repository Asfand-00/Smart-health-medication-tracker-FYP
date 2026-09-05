/**
 * MEDICATION HISTORY MODEL — medicationHistory.model.js
 * =======================================================
 * Tracks taken/missed doses of medications.
 */

const mongoose = require("mongoose");

const medicationHistorySchema = new mongoose.Schema(
  {
    medicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medication",
      required: true,
    },
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
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    timeOfDay: {
      type: String,
      enum: ["Morning", "Afternoon", "Evening", "Night"],
      required: true,
    },
    status: {
      type: String,
      enum: ["taken", "missed"],
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MedicationHistory", medicationHistorySchema);
