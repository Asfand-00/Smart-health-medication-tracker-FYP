/**
 * EMERGENCY CONTACT MODEL — emergencyContact.model.js
 * ======================================================
 * Extended emergency contacts for patients.
 * Supports multiple contacts with alert preferences.
 */

const mongoose = require("mongoose");

const emergencyContactSchema = new mongoose.Schema(
  {
    patientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Contact name is required"],
      trim: true,
    },
    relation: {
      type: String,
      required: [true, "Relation is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      default: "",
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    canReceiveAlerts: {
      type: Boolean,
      default: true,
    },
    notificationPreferences: {
      missedDose: { type: Boolean, default: true },
      emergencyOnly: { type: Boolean, default: false },
      dailyReport: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

emergencyContactSchema.index({ patientUserId: 1 });

module.exports = mongoose.model("EmergencyContact", emergencyContactSchema);
