/**
 * VITALS MODEL — vitals.model.js
 * ===============================
 * Stores patient health vitals like blood pressure, heart rate, etc.
 */

const mongoose = require("mongoose");

const vitalsSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bloodPressure: {
      systolic: { type: Number },
      diastolic: { type: Number },
    },
    heartRate: {
      type: Number, // bpm
    },
    bloodSugar: {
      type: Number, // mg/dL
    },
    weight: {
      type: Number, // kg
    },
    temperature: {
      type: Number, // Celsius
    },
    oxygenLevel: {
      type: Number, // SpO2 percentage
    },
    note: {
      type: String,
      trim: true,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vitals", vitalsSchema);
