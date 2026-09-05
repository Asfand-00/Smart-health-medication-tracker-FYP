/**
 * REMINDER MODEL — reminder.model.js
 * =====================================
 * Stores reminders created by caregivers for patients.
 * Also stores patient's own reminders.
 */

const mongoose = require("mongoose");

const reminderSchema = new mongoose.Schema(
  {
    // Who created this reminder (caregiver or patient themselves)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Which patient this reminder belongs to
    patientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: [true, "Reminder title is required"],
      trim: true,
    },
    message: {
      type: String,
      trim: true,
      default: "",
    },
    reminderType: {
      type: String,
      enum: ["medication", "appointment", "exercise", "meal", "general", "poke"],
      default: "general",
    },
    // For medication-specific reminders
    medicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medication",
      default: null,
    },
    scheduledTime: {
      type: Date,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Reminder", reminderSchema);
