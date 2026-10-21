/**
 * USER CONTROLLER — user.controller.js
 * =======================================
 * Handles HTTP requests for user profile, recovery options, privacy and
 * (legacy) admin user operations.
 */

const { validationResult } = require("express-validator");
const userService = require("./user.service");
const audit = require("../audit/audit.service");

// GET /api/user/profile — get current user's profile
const getProfile = async (req, res, next) => {
  try {
    const user = await userService.getUserProfile(req.user.id);
    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/user/profile — update current user's profile
const updateProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        message: "Validation failed",
        errors: errors.array().map((err) => ({ field: err.path, message: err.msg })),
      });
    }
    const updatedUser = await userService.updateUserProfile(req.user.id, req.body);
    res.status(200).json({ success: true, message: "Profile updated successfully!", data: { user: updatedUser } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/user/recovery — recovery email / phone
const updateRecovery = async (req, res, next) => {
  try {
    const user = await userService.updateRecoveryOptions(req.user.id, req.body);
    await audit.record(req, { action: "user.recovery_options_updated", category: "security" });
    res.status(200).json({ success: true, message: "Recovery options saved.", data: { user } });
  } catch (error) {
    next(error);
  }
};

// GET /api/user/export — download everything we hold about me (JSON)
const exportData = async (req, res, next) => {
  try {
    const data = await userService.exportUserData(req.user.id);
    await audit.record(req, { action: "user.data_exported", category: "data" });
    res.setHeader("Content-Disposition", `attachment; filename=my-data-${req.user.id}.json`);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/user/me — delete (deactivate + anonymise) my account
const deleteMe = async (req, res, next) => {
  try {
    await userService.deleteOwnAccount(req.user.id, req.body?.password);
    await audit.record(req, { action: "user.account_deleted", category: "security" });
    res.status(200).json({ success: true, message: "Your account has been deleted." });
  } catch (error) {
    next(error);
  }
};

// POST /api/user/consent — record privacy policy acceptance
const consent = async (req, res, next) => {
  try {
    const user = await userService.recordConsent(req.user.id);
    res.status(200).json({ success: true, message: "Consent recorded.", data: { user } });
  } catch (error) {
    next(error);
  }
};

// GET /api/user/all — get all users (Admin only)
const getAllUsers = async (req, res, next) => {
  try {
    const users = await userService.getAllUsers();
    res.status(200).json({ success: true, count: users.length, data: { users } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/user/:id — Admin updates a user
const adminUpdateUser = async (req, res, next) => {
  try {
    const updatedUser = await userService.adminUpdateUser(req.params.id, req.body);
    await audit.record(req, { action: "admin.user_updated", category: "admin", targetUserId: req.params.id, entityType: "User", entityId: req.params.id, metadata: { fields: Object.keys(req.body) } });
    res.status(200).json({ success: true, message: "User updated successfully!", data: { user: updatedUser } });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/user/:id — Admin deletes a user
const adminDeleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user.id.toString()) {
      return res.status(400).json({ success: false, message: "You cannot delete your own account." });
    }
    await userService.adminDeleteUser(req.params.id);
    await audit.record(req, { action: "admin.user_deleted", category: "admin", targetUserId: req.params.id, entityType: "User", entityId: req.params.id });
    res.status(200).json({ success: true, message: "User deleted successfully!" });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile, updateRecovery, exportData, deleteMe, consent, getAllUsers, adminUpdateUser, adminDeleteUser };
