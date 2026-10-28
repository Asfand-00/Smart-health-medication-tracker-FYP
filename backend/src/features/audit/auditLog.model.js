/**
 * AUDIT LOG MODEL — auditLog.model.js
 * =====================================
 * Immutable record of security-relevant and data-changing actions:
 * who did what, to which entity, from where, and whether it succeeded.
 * Powers the admin "Access logs & audit trail" screen and each user's
 * own activity view.
 */

const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    userRole: { type: String, default: null },
    // e.g. auth.login, auth.login_failed, user.update, prescription.upload
    action: { type: String, required: true, trim: true, index: true },
    category: {
      type: String,
      enum: ["auth", "user", "patient", "medication", "prescription", "adherence", "notification", "admin", "security", "data", "system", "request"],
      default: "request",
    },
    entityType: { type: String, default: null },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: ["success", "failure", "denied"], default: "success" },
    method: { type: String, default: null },
    path: { type: String, default: null },
    statusCode: { type: Number, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    details: { type: String, trim: true, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ category: 1, createdAt: -1 });
auditLogSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
