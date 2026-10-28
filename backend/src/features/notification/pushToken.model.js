/**
 * PUSH TOKEN MODEL — pushToken.model.js
 * =======================================
 * One document per device that may receive OS push notifications.
 */

const mongoose = require("mongoose");

const pushTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true, unique: true, trim: true },
    platform: { type: String, enum: ["ios", "android", "web", "unknown"], default: "unknown" },
    deviceName: { type: String, trim: true, default: "" },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

pushTokenSchema.index({ userId: 1 });

module.exports = mongoose.model("PushToken", pushTokenSchema);
