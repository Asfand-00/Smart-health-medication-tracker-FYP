/**
 * DOCTOR NOTE MODEL — doctorNote.model.js
 * ==========================================
 * Notes from doctors about patients — prescriptions,
 * observations, assessments, and recommendations.
 */

const mongoose = require("mongoose");

const doctorNoteSchema = new mongoose.Schema(
  {
    doctorId: {
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
      enum: ["prescription", "observation", "assessment", "recommendation", "follow_up"],
      default: "observation",
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
    isConfidential: {
      type: Boolean,
      default: false,
    },
    diagnosis: {
      type: String,
      trim: true,
      default: "",
    },
    followUpDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

doctorNoteSchema.index({ doctorId: 1, patientUserId: 1, createdAt: -1 });

module.exports = mongoose.model("DoctorNote", doctorNoteSchema);
