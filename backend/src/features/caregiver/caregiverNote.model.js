/**
 * CAREGIVER NOTE MODEL — caregiverNote.model.js
 * ================================================
 * Notes written by caregivers about their patients.
 * Supports multiple note types and severity levels.
 */

const mongoose = require("mongoose");

const caregiverNoteSchema = new mongoose.Schema(
  {
    caregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    patientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    noteType: {
      type: String,
      enum: ["general", "medication", "cognitive", "behavioral", "safety", "daily_report"],
      default: "general",
    },
    title: {
      type: String,
      required: [true, "Note title is required"],
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: [true, "Note content is required"],
      trim: true,
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low",
    },
    tags: {
      type: [String],
      default: [],
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

caregiverNoteSchema.index({ caregiverId: 1, patientUserId: 1, createdAt: -1 });

module.exports = mongoose.model("CaregiverNote", caregiverNoteSchema);
