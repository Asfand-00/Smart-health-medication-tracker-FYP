/**
 * MEDICATION MODEL — medication.model.js
 * ========================================
 * Stores individual medications prescribed to a patient.
 */

const mongoose = require("mongoose");

const medicationSchema = new mongoose.Schema(
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
    medicineName: {
      type: String,
      required: [true, "Medicine name is required"],
      trim: true,
    },
    dosage: {
      type: String,
      required: [true, "Dosage is required (e.g., 1 tablet, 500mg)"],
      trim: true,
    },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "custom"],
      default: "daily",
    },
    timeOfDay: {
      type: [String],
      enum: ["Morning", "Afternoon", "Evening", "Night"],
      required: [true, "At least one time of day is required"],
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String, // Doctor instructions
      trim: true,
      default: "",
    },
    // Provenance
    prescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Prescription", default: null },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "MedicationTemplate", default: null },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    addedByRole: { type: String, enum: ["patient", "caregiver", "doctor", "admin", null], default: null },
    addedByCaregiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

medicationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Medication", medicationSchema);
