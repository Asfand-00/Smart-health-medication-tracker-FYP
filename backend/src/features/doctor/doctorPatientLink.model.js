/**
 * DOCTOR ↔ PATIENT LINK MODEL — doctorPatientLink.model.js
 * ==========================================================
 * Mirrors ConnectionRequest (patient ↔ caregiver) for doctors. A patient
 * asks a doctor to supervise them (or a doctor invites a patient); once
 * accepted the doctor can see adherence, prescriptions, risk and notes.
 */

const mongoose = require("mongoose");

const doctorPatientLinkSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    patientUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted", "declined", "ended"], default: "pending" },
    requestedBy: { type: String, enum: ["patient", "doctor"], default: "patient" },
    message: { type: String, trim: true, default: "" },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

doctorPatientLinkSchema.index({ doctorId: 1, patientUserId: 1 });
doctorPatientLinkSchema.index({ patientUserId: 1, status: 1 });

module.exports = mongoose.model("DoctorPatientLink", doctorPatientLinkSchema);
