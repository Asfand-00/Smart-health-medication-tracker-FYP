/**
 * USER SERVICE — user.service.js
 * ================================
 * Business logic for user profile operations.
 */

const User = require("./user.model");

// ── GET PROFILE ──────────────────────────────────────────────────────────
const getUserProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }
  return user.getPublicProfile();
};

// ── UPDATE PROFILE ────────────────────────────────────────────────────────
/**
 * updateUserProfile — updates allowed profile fields
 * NOTE: password and role changes are handled separately for security.
 */
const updateUserProfile = async (userId, updateData) => {
  // Whitelist the fields that users are allowed to update
  // This prevents users from changing their role or password via this endpoint
  const allowedFields = ["firstName", "lastName", "phone", "dateOfBirth", "gender", "avatar"];

  // Build the update object with only whitelisted fields
  const filteredData = {};
  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      filteredData[field] = updateData[field];
    }
  });

  // findByIdAndUpdate:
  // { new: true }        → returns the UPDATED document (not the old one)
  // { runValidators: true } → runs schema validation on update
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: filteredData },
    { new: true, runValidators: true }
  );

  if (!updatedUser) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  return updatedUser.getPublicProfile();
};

// ── GET ALL USERS (Admin only) ─────────────────────────────────────────
const getAllUsers = async () => {
  // Find all active users, exclude passwords, sort by newest first
  const users = await User.find({ isActive: true })
    .select("-password -passwordResetToken -passwordResetExpires")
    .sort({ createdAt: -1 });

  return users;
};

// ── ADMIN: UPDATE USER ──────────────────────────────────────────────────
const adminUpdateUser = async (userId, updateData) => {
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: updateData }, // Admin can update more fields (like role, isActive)
    { new: true, runValidators: true }
  );

  if (!updatedUser) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }
  return updatedUser.getPublicProfile();
};

// ── ADMIN: DELETE USER ──────────────────────────────────────────────────
const adminDeleteUser = async (userId) => {
  const user = await User.findByIdAndDelete(userId);
  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }
  return user;
};

module.exports = { getUserProfile, updateUserProfile, getAllUsers, adminUpdateUser, adminDeleteUser };
