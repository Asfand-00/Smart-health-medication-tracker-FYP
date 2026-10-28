/**
 * USER SERVICE — user.service.js
 * ================================
 * Business logic for user profile operations, account recovery settings,
 * privacy (data export / account deletion) and admin user management.
 */

const User = require("./user.model");

const httpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// ── GET PROFILE ──────────────────────────────────────────────────────────
const getUserProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw httpError("User not found.", 404);
  return user.getPublicProfile();
};

// ── UPDATE PROFILE ────────────────────────────────────────────────────────
const updateUserProfile = async (userId, updateData) => {
  // Whitelist — prevents users from changing their role or password here
  const allowedFields = ["firstName", "lastName", "phone", "dateOfBirth", "gender", "avatar", "speciality", "licenseNumber"];
  const filteredData = {};
  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) filteredData[field] = updateData[field];
  });
  // The mobile app sends '' for "prefer not to say"; the enum needs the real value.
  if (filteredData.gender === "") filteredData.gender = "prefer_not_to_say";

  const updatedUser = await User.findByIdAndUpdate(userId, { $set: filteredData }, { new: true, runValidators: true });
  if (!updatedUser) throw httpError("User not found.", 404);
  return updatedUser.getPublicProfile();
};

// ── ACCOUNT RECOVERY OPTIONS ──────────────────────────────────────────────
const updateRecoveryOptions = async (userId, { recoveryEmail, phone }) => {
  const update = {};
  if (recoveryEmail !== undefined) {
    const value = String(recoveryEmail).trim().toLowerCase();
    if (value && !/^\S+@\S+\.\S+$/.test(value)) throw httpError("Recovery email is not a valid email address.", 400);
    update.recoveryEmail = value;
  }
  if (phone !== undefined) update.phone = String(phone).trim() || null;
  const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true });
  if (!user) throw httpError("User not found.", 404);
  return user.getPublicProfile();
};

// ── PRIVACY: export everything we hold about the user ─────────────────────
const exportUserData = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw httpError("User not found.", 404);

  const Patient = require("../patient/patient.model");
  const Medication = require("../medication/medication.model");
  const AdherenceLog = require("../adherence/adherenceLog.model");
  const Vitals = require("../vitals/vitals.model");
  const Notification = require("../notification/notification.model");
  const MoodTracking = require("../patient/moodTracking.model");
  const EmergencyContact = require("../patient/emergencyContact.model");
  const Prescription = require("../prescription/prescription.model");
  const AuditLog = require("../audit/auditLog.model");

  const [profile, medications, adherence, vitals, notifications, moods, contacts, prescriptions, activity] = await Promise.all([
    Patient.findOne({ userId }),
    Medication.find({ userId }),
    AdherenceLog.find({ userId }).sort({ date: -1 }),
    Vitals.find({ patientId: userId }).sort({ recordedAt: -1 }),
    Notification.find({ userId }).sort({ createdAt: -1 }).limit(500),
    MoodTracking.find({ patientUserId: userId }),
    EmergencyContact.find({ patientUserId: userId }),
    Prescription.find({ patientUserId: userId }).select("-file.storagePath"),
    AuditLog.find({ userId }).sort({ createdAt: -1 }).limit(500),
  ]);

  return {
    exportedAt: new Date(),
    account: user.getPublicProfile(),
    medicalProfile: profile,
    medications,
    adherenceLogs: adherence,
    vitals,
    moods,
    emergencyContacts: contacts,
    prescriptions,
    notifications,
    activity,
  };
};

// ── PRIVACY: delete / deactivate own account ──────────────────────────────
const deleteOwnAccount = async (userId, password) => {
  const user = await User.findById(userId).select("+password");
  if (!user) throw httpError("User not found.", 404);
  if (user.role === "admin") throw httpError("Administrator accounts cannot be self-deleted.", 400);
  const ok = await user.comparePassword(password || "");
  if (!ok) throw httpError("Password is incorrect.", 400);

  // Soft delete: the account is deactivated and anonymised, medical records
  // stay available to the care team for continuity of care.
  user.isActive = false;
  user.deletedAt = new Date();
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.email = `deleted-${user._id}@deleted.local`;
  user.phone = null;
  user.recoveryEmail = "";
  await user.save({ validateBeforeSave: false });

  const PushToken = require("../notification/pushToken.model");
  await PushToken.deleteMany({ userId });
  return true;
};

const recordConsent = async (userId) => {
  const user = await User.findByIdAndUpdate(userId, { $set: { privacyConsentAt: new Date() } }, { new: true });
  if (!user) throw httpError("User not found.", 404);
  return user.getPublicProfile();
};

// ── GET ALL USERS (Admin only) ─────────────────────────────────────────
const getAllUsers = async () => {
  return User.find({ isActive: true }).select("-password -passwordResetToken -passwordResetExpires").sort({ createdAt: -1 });
};

// ── ADMIN: UPDATE USER ──────────────────────────────────────────────────
const adminUpdateUser = async (userId, updateData) => {
  const allowed = ["firstName", "lastName", "email", "role", "isActive", "phone", "gender", "dateOfBirth", "speciality", "licenseNumber"];
  const filtered = {};
  allowed.forEach((f) => {
    if (updateData[f] !== undefined) filtered[f] = updateData[f];
  });
  const updatedUser = await User.findByIdAndUpdate(userId, { $set: filtered }, { new: true, runValidators: true });
  if (!updatedUser) throw httpError("User not found.", 404);
  return updatedUser.getPublicProfile();
};

// ── ADMIN: DELETE USER ──────────────────────────────────────────────────
const adminDeleteUser = async (userId) => {
  const user = await User.findByIdAndDelete(userId);
  if (!user) throw httpError("User not found.", 404);
  return user;
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  updateRecoveryOptions,
  exportUserData,
  deleteOwnAccount,
  recordConsent,
  getAllUsers,
  adminUpdateUser,
  adminDeleteUser,
};
