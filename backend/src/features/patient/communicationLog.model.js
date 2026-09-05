/**
 * COMMUNICATION LOG MODEL — communicationLog.model.js
 * =====================================================
 * Audit trail for all significant actions in the system.
 */

const mongoose = require("mongoose");

const communicationLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    entityType: {
      type: String,
      enum: [
        "medication",
        "reminder",
        "adherence",
        "note",
        "assessment",
        "observation",
        "notification",
        "user",
        "connection",
        "emergency_contact",
        "mood",
        "vitals",
        "report",
      ],
      default: null,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    details: {
      type: String,
      trim: true,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

communicationLogSchema.index({ userId: 1, createdAt: -1 });
communicationLogSchema.index({ targetUserId: 1, createdAt: -1 });
communicationLogSchema.index({ entityType: 1, entityId: 1 });

module.exports = mongoose.model("CommunicationLog", communicationLogSchema);
