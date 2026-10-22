/**
 * AUTH CONTROLLER — auth.controller.js
 * ========================================
 * Controllers handle HTTP requests and send HTTP responses.
 * They are THIN — they delegate all logic to the service layer.
 *
 * PATTERN: Request → Controller → Service → Database → Response
 */

const { validationResult } = require("express-validator");
const authService = require("./auth.service");
const audit = require("../audit/audit.service");

const validationFailed = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(422).json({
    success: false,
    message: "Validation failed",
    errors: errors.array().map((err) => ({ field: err.path, message: err.msg })),
  });
  return true;
};

// ── REGISTER CONTROLLER ──────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    if (validationFailed(req, res)) return;
    const { firstName, lastName, email, password, role, phone } = req.body;

    // Security: Prevent admin registration via public API
    if (role === "admin") {
      return res.status(403).json({ success: false, message: "Admin registration is not allowed." });
    }

    const result = await authService.registerUser({ firstName, lastName, email, password, role, phone });
    await audit.record(req, { userId: result.user._id, userRole: result.user.role, action: "auth.register", category: "auth", details: `Registered as ${result.user.role}` });

    res.status(201).json({
      success: true,
      message: "Account created successfully! Welcome to Smart Medication Tracker.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ── LOGIN CONTROLLER ─────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    if (validationFailed(req, res)) return;
    const { email, password } = req.body;

    try {
      const result = await authService.loginUser(email, password);
      await audit.record(req, { userId: result.user._id, userRole: result.user.role, action: "auth.login", category: "auth" });
      res.status(200).json({ success: true, message: "Login successful! Welcome back.", data: result });
    } catch (error) {
      await audit.record(req, {
        userId: error.failedUserId || null,
        action: error.locked ? "auth.login_locked" : "auth.login_failed",
        category: "auth",
        status: "failure",
        details: `Login failed for ${String(email).toLowerCase()}`,
      });
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

// ── GET ME CONTROLLER ────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: { user: req.user } });
  } catch (error) {
    next(error);
  }
};

// ── CHANGE PASSWORD ──────────────────────────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    if (validationFailed(req, res)) return;
    const { currentPassword, newPassword } = req.body;
    try {
      const result = await authService.changePassword(req.user._id, currentPassword, newPassword);
      await audit.record(req, { action: "auth.password_changed", category: "security" });
      res.status(200).json({ success: true, message: "Password changed successfully. Other devices have been signed out.", data: result });
    } catch (error) {
      await audit.record(req, { action: "auth.password_change_failed", category: "security", status: "failure", details: error.message });
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

// ── FORGOT PASSWORD ──────────────────────────────────────────────────────
const forgotPassword = async (req, res, next) => {
  try {
    if (validationFailed(req, res)) return;
    const result = await authService.requestPasswordReset(req.body.email);
    await audit.record(req, {
      userId: result.userId || null,
      action: "auth.password_reset_requested",
      category: "security",
      status: result.sent ? "success" : "failure",
      details: `Reset requested for ${String(req.body.email).toLowerCase()}`,
    });
    res.status(200).json({
      success: true,
      message: "If an account exists for that email, a 6-digit reset code has been sent.",
      data: { expiresInMinutes: result.expiresInMinutes || 15, ...(result.devCode ? { devCode: result.devCode } : {}) },
    });
  } catch (error) {
    next(error);
  }
};

// ── RESET PASSWORD ───────────────────────────────────────────────────────
const resetPassword = async (req, res, next) => {
  try {
    if (validationFailed(req, res)) return;
    const { email, code, newPassword } = req.body;
    try {
      const result = await authService.resetPassword(email, code, newPassword);
      await audit.record(req, { userId: result.user._id, userRole: result.user.role, action: "auth.password_reset", category: "security" });
      res.status(200).json({ success: true, message: "Password reset successfully. You are now signed in.", data: result });
    } catch (error) {
      await audit.record(req, { action: "auth.password_reset_failed", category: "security", status: "failure", details: error.message });
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

// ── LOGOUT / LOGOUT EVERYWHERE ───────────────────────────────────────────
const logout = async (req, res, next) => {
  try {
    const everywhere = req.body?.everywhere === true || req.query.everywhere === "true";
    if (everywhere) await authService.revokeAllSessions(req.user._id);
    await audit.record(req, { action: everywhere ? "auth.logout_all" : "auth.logout", category: "auth" });
    res.status(200).json({ success: true, message: everywhere ? "Signed out on all devices." : "Signed out." });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, changePassword, forgotPassword, resetPassword, logout };
