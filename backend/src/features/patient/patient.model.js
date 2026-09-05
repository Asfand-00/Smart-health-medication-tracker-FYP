/**
 * PATIENT MODEL — patient.model.js
 * =================================
 * This schema defines the structure for a Patient's profile.
 * It is strictly linked to a User document via `userId`.
 */

const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    // Link to the User Auth Model
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // One User can only have ONE Patient profile
    },

    // ── Personal Info ────────────────────────
    dateOfBirth: {
      type: Date,
      required: [true, "Date of birth is required"],
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
      required: [true, "Gender is required"],
    },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"],
      default: "Unknown",
    },
    height: {
      type: Number, // in cm
      default: null,
    },
    weight: {
      type: Number, // in kg
      default: null,
    },

    // ── Medical History ───────────────────────
    medicalHistory: {
      chronicDiseases: {
        type: [String],
        default: [],
      },
      allergies: {
        type: [String],
        default: [],
      },
      pastSurgeries: {
        type: [String],
        default: [],
      },
      familyHistory: {
        type: [String],
        default: [],
      },
    },

    // ── Emergency Contact ─────────────────────
    emergencyContact: {
      name: { type: String, default: "" },
      relation: { type: String, default: "" },
      phone: { type: String, default: "" },
    },

    // ── Caregiver Link (For Future Module) ────
    assignedCaregivers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

module.exports = mongoose.model("Patient", patientSchema);
