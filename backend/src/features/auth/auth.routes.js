/**
 * AUTH ROUTES — auth.routes.js
 * ==============================
 * POST /api/auth/register         → create an account
 * POST /api/auth/login            → sign in (rate limited, lockout after failures)
 * GET  /api/auth/me               → current user (protected)
 * PUT  /api/auth/change-password  → change password, signs out other devices (protected)
 * POST /api/auth/forgot-password  → email a 6-digit recovery code
 * POST /api/auth/reset-password   → set a new password with the code
 * POST /api/auth/logout           → audit sign-out; { everywhere: true } revokes all sessions
 */

const express = require("express");
const router = express.Router();

const { register, login, getMe, changePassword, forgotPassword, resetPassword, logout } = require("./auth.controller");
const {
  registerValidation,
  loginValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} = require("./auth.validation");
const { protect } = require("../../middleware/authMiddleware");
const { authLimiter, recoveryLimiter } = require("../../middleware/security");

router.post("/register", authLimiter, registerValidation, register);
router.post("/login", authLimiter, loginValidation, login);
router.post("/forgot-password", recoveryLimiter, forgotPasswordValidation, forgotPassword);
router.post("/reset-password", recoveryLimiter, resetPasswordValidation, resetPassword);

router.get("/me", protect, getMe);
router.put("/change-password", protect, changePasswordValidation, changePassword);
router.post("/logout", protect, logout);

module.exports = router;
