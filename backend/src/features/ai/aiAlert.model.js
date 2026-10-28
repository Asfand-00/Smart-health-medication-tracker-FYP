/**
 * AI ALERT MODEL — aiAlert.model.js
 * ===================================
 * Preventive alerts raised by the prediction engine. One record per
 * patient / medication / slot / day (or per risk flag per day) so the same
 * warning is not repeated.
 */

const mongoose = require("mongoose");

const aiAlertSchema = new mongoose.Schema(
  {
    patientUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: ["missed_dose_prediction", "risk_flag"], required: true },
    code: { type: String, required: true }, // e.g. consecutive_misses, Morning:<medId>
    medicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Medication", default: null },
    medicineName: { type: String, default: "" },
    timeOfDay: { type: String, enum: ["Morning", "Afternoon", "Evening", "Night", null], default: null },
    date: { type: String, required: true }, // YYYY-MM-DD the alert applies to
    probability: { type: Number, min: 0, max: 1, default: null },
    severity: { type: String, enum: ["low", "moderate", "high", "critical"], default: "moderate" },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    recommendation: { type: String, default: "" },
    notifiedPatient: { type: Boolean, default: false },
    notifiedCareCircle: { type: Boolean, default: false },
    outcome: { type: String, enum: ["pending", "taken", "missed", "skipped", "n/a"], default: "pending" },
  },
  { timestamps: true }
);

aiAlertSchema.index({ patientUserId: 1, code: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("AiAlert", aiAlertSchema);
