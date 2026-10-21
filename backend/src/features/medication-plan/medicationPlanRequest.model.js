/**
 * MEDICATION PLAN REQUEST MODEL — medicationPlanRequest.model.js
 * ================================================================
 * FR8 / FR9: a patient (or caregiver) proposes a change to the medication
 * plan — add, update or stop a medication — and a supervisor (caregiver or
 * doctor) approves or rejects it. Approval applies the change.
 */

const mongoose = require("mongoose");

const proposedSchema = new mongoose.Schema(
  {
    medicineName: { type: String, trim: true },
    dosage: { type: String, trim: true },
    frequency: { type: String, enum: ["daily", "weekly", "custom"] },
    timeOfDay: { type: [String], enum: ["Morning", "Afternoon", "Evening", "Night"] },
    startDate: { type: Date },
    endDate: { type: Date },
    description: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const medicationPlanRequestSchema = new mongoose.Schema(
  {
    patientUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    requestedByRole: { type: String, enum: ["patient", "caregiver"], required: true },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reviewerRole: { type: String, enum: ["caregiver", "doctor"], required: true },
    type: { type: String, enum: ["add", "update", "stop"], required: true },
    medicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Medication", default: null },
    medicationSnapshot: { type: proposedSchema, default: null },
    proposed: { type: proposedSchema, default: null },
    reason: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected", "cancelled"], default: "pending", index: true },
    reviewNote: { type: String, trim: true, default: "" },
    reviewedAt: { type: Date, default: null },
    resultMedicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Medication", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MedicationPlanRequest", medicationPlanRequestSchema);
