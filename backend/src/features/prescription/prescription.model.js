/**
 * PRESCRIPTION MODEL — prescription.model.js
 * ============================================
 * A prescription record: who it is for, who issued/uploaded it, the
 * medications it lists (typed in, or extracted from text / attached
 * document), the encrypted file on disk, the verification state and a full
 * change history for traceability.
 */

const mongoose = require("mongoose");

const prescribedMedicationSchema = new mongoose.Schema(
  {
    medicineName: { type: String, required: true, trim: true },
    dosage: { type: String, trim: true, default: "" },
    frequency: { type: String, enum: ["daily", "weekly", "custom"], default: "daily" },
    timeOfDay: { type: [String], enum: ["Morning", "Afternoon", "Evening", "Night"], default: ["Morning"] },
    durationDays: { type: Number, default: null },
    instructions: { type: String, trim: true, default: "" },
    sourceLine: { type: String, trim: true, default: "" },
    confidence: { type: Number, min: 0, max: 1, default: 1 },
  },
  { _id: true }
);

const historySchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    byUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    byRole: { type: String, default: null },
    note: { type: String, trim: true, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    patientUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    uploadedByRole: { type: String, enum: ["patient", "caregiver", "doctor", "admin"], required: true },
    // Doctor in the system who issued it (when a doctor uploads) or who verified it
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    doctorName: { type: String, trim: true, default: "" },
    title: { type: String, required: [true, "Title is required"], trim: true, maxlength: 200 },
    issuedDate: { type: Date, default: Date.now },
    expiryDate: { type: Date, default: null },
    diagnosis: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    // Free-text prescription (typed or OCR'd elsewhere) used to generate the plan
    rawText: { type: String, trim: true, default: "" },
    medications: { type: [prescribedMedicationSchema], default: [] },
    file: {
      originalName: { type: String, default: null },
      mimeType: { type: String, default: null },
      size: { type: Number, default: null },
      storagePath: { type: String, default: null, select: false },
      checksum: { type: String, default: null },
      encrypted: { type: Boolean, default: true },
    },
    status: { type: String, enum: ["pending", "verified", "rejected", "expired"], default: "pending", index: true },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },
    verificationNote: { type: String, trim: true, default: "" },
    appliedAt: { type: Date, default: null },
    appliedMedicationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Medication" }],
    isArchived: { type: Boolean, default: false },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true }
);

prescriptionSchema.index({ patientUserId: 1, createdAt: -1 });
prescriptionSchema.index({ doctorId: 1, status: 1 });

module.exports = mongoose.model("Prescription", prescriptionSchema);
