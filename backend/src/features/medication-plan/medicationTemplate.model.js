/**
 * MEDICATION TEMPLATE MODEL — medicationTemplate.model.js
 * =========================================================
 * FR12: reusable treatment plans ("common treatment plans") that can be
 * applied to a patient in one tap. Global templates are seeded by the
 * system and managed by admins/doctors; users can also save their own.
 */

const mongoose = require("mongoose");

const templateItemSchema = new mongoose.Schema(
  {
    medicineName: { type: String, required: true, trim: true },
    dosage: { type: String, required: true, trim: true },
    frequency: { type: String, enum: ["daily", "weekly", "custom"], default: "daily" },
    timeOfDay: { type: [String], enum: ["Morning", "Afternoon", "Evening", "Night"], default: ["Morning"] },
    durationDays: { type: Number, default: null },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: true }
);

const medicationTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, default: "" },
    category: { type: String, trim: true, default: "General" },
    items: { type: [templateItemSchema], default: [] },
    isGlobal: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

medicationTemplateSchema.index({ isGlobal: 1, category: 1 });
medicationTemplateSchema.index({ createdBy: 1 });

module.exports = mongoose.model("MedicationTemplate", medicationTemplateSchema);
