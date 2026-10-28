/**
 * AUTH SERVICE — auth.service.js
 * ================================
 * Business logic for registration, login, session management, password
 * change and account recovery (one-time code sent by email).
 *
 * RULE: Never put database queries directly in controllers.
 */

const jwt = require("jsonwebtoken");
const User = require("../user/user.model");
const SystemConfig = require("../admin/systemConfig.model");
const { sendEmail } = require("../../utils/email");
const { sha256, generateOtp } = require("../../utils/crypto");

const httpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// ── HELPER: Generate JWT Token ───────────────────────────────────────────
/**
 * The payload carries the user id, role and the current tokenVersion (`tv`)
 * so the auth middleware can reject tokens issued before a password change.
 */
const generateToken = (user, sessionDays) => {
  const expiresIn = sessionDays ? `${sessionDays}d` : process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign({ userId: user._id, role: user.role, tv: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn });
};

const validatePasswordPolicy = (password, config) => {
  const minLength = config?.security?.passwordMinLength || 6;
  if (!password || password.length < minLength) {
    throw httpError(`Password must be at least ${minLength} characters.`, 400);
  }
  if ((config?.security?.passwordRequireNumber ?? true) && !/\d/.test(password)) {
    throw httpError("Password must contain at least one number.", 400);
  }
};

// ── REGISTER SERVICE ─────────────────────────────────────────────────────
const registerUser = async (userData) => {
  const { firstName, lastName, email, password, role, phone } = userData;
  const config = await SystemConfig.getConfig();

  if (!config.allowRegistration) {
    throw httpError("Registration is currently disabled by the administrator.", 403);
  }
  const wantedRole = role || "patient";
  if (!config.registrationRoles.includes(wantedRole)) {
    throw httpError(`Self-registration as ${wantedRole} is not allowed.`, 403);
  }
  validatePasswordPolicy(password, config);

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) throw httpError("An account with this email already exists.", 400);

  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    role: wantedRole,
    phone: phone || null,
    privacyConsentAt: new Date(),
    lastLoginAt: new Date(),
  });

  const token = generateToken(user, config.security?.sessionDays);
  return { token, user: user.getPublicProfile() };
};

// ── LOGIN SERVICE ────────────────────────────────────────────────────────
/**
 * Same generic error for "email not found" and "wrong password" (prevents
 * account enumeration). After `maxLoginAttempts` failures the account is
 * locked for `lockoutMinutes`.
 */
const loginUser = async (email, password) => {
  const config = await SystemConfig.getConfig();
  const user = await User.findOne({ email: email.toLowerCase() }).select("+password +failedLoginAttempts +lockUntil");

  if (!user || !user.isActive || user.deletedAt) {
    throw httpError("Invalid email or password.", 401);
  }

  if (user.isLocked()) {
    const minutes = Math.max(1, Math.ceil((user.lockUntil - Date.now()) / 60000));
    const error = httpError(`Account temporarily locked after too many failed attempts. Try again in ${minutes} minute(s).`, 423);
    error.locked = true;
    throw error;
  }

  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    const max = config.security?.maxLoginAttempts || 5;
    if (user.failedLoginAttempts >= max) {
      user.lockUntil = new Date(Date.now() + (config.security?.lockoutMinutes || 15) * 60000);
      user.failedLoginAttempts = 0;
    }
    await user.save({ validateBeforeSave: false });
    const error = httpError("Invalid email or password.", 401);
    error.failedUserId = user._id;
    throw error;
  }

  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  const token = generateToken(user, config.security?.sessionDays);
  return { token, user: user.getPublicProfile() };
};

// ── CHANGE PASSWORD (logged-in) ──────────────────────────────────────────
const changePassword = async (userId, currentPassword, newPassword) => {
  const config = await SystemConfig.getConfig();
  const user = await User.findById(userId).select("+password");
  if (!user) throw httpError("User not found.", 404);

  const ok = await user.comparePassword(currentPassword);
  if (!ok) throw httpError("Current password is incorrect.", 400);
  if (currentPassword === newPassword) throw httpError("New password must be different from the current one.", 400);
  validatePasswordPolicy(newPassword, config);

  user.password = newPassword;
  user.tokenVersion = (user.tokenVersion || 0) + 1; // sign out every other device
  await user.save();

  sendEmail({
    to: user.email,
    subject: "Your password was changed",
    text: `Hi ${user.firstName}, your Smart Medication Tracker password was just changed. If this was not you, reset your password immediately.`,
    html: `<p>Hi ${user.firstName},</p><p>Your Smart Medication Tracker password was just changed. If this was not you, reset your password immediately.</p>`,
  }).catch(() => {});

  const token = generateToken(user, config.security?.sessionDays);
  return { token, user: user.getPublicProfile() };
};

// ── FORGOT PASSWORD (request a code) ─────────────────────────────────────
/**
 * Generates a 6-digit one-time code, stores its hash with an expiry and
 * emails it to the account email and the recovery email (if set). Always
 * resolves successfully so the caller cannot tell whether the email exists.
 */
const requestPasswordReset = async (email) => {
  const config = await SystemConfig.getConfig();
  const user = await User.findOne({ email: email.toLowerCase(), isActive: true }).select("+passwordResetToken +passwordResetExpires +passwordResetAttempts");
  if (!user) return { sent: false };

  const code = generateOtp();
  const minutes = config.security?.otpExpiryMinutes || 15;
  user.passwordResetToken = sha256(code);
  user.passwordResetExpires = new Date(Date.now() + minutes * 60000);
  user.passwordResetAttempts = 0;
  await user.save({ validateBeforeSave: false });

  const recipients = [user.email];
  if (user.recoveryEmail && user.recoveryEmail !== user.email) recipients.push(user.recoveryEmail);

  for (const to of recipients) {
    await sendEmail({
      to,
      subject: "Your password reset code",
      text: `Hi ${user.firstName}, your password reset code is ${code}. It expires in ${minutes} minutes. If you did not request this, ignore this email.`,
      html: `<p>Hi ${user.firstName},</p><p>Your password reset code is:</p><h2 style="letter-spacing:6px">${code}</h2><p>It expires in ${minutes} minutes. If you did not request this, you can ignore this email.</p>`,
    });
  }

  // In development the code is returned so the flow can be exercised
  // without an SMTP server. Never in production.
  const devCode = process.env.NODE_ENV !== "production" && process.env.EXPOSE_RESET_CODE !== "false" ? code : undefined;
  return { sent: true, userId: user._id, expiresInMinutes: minutes, devCode };
};

// ── RESET PASSWORD (with the code) ───────────────────────────────────────
const resetPassword = async (email, code, newPassword) => {
  const config = await SystemConfig.getConfig();
  const user = await User.findOne({ email: email.toLowerCase() }).select("+password +passwordResetToken +passwordResetExpires +passwordResetAttempts");
  if (!user || !user.passwordResetToken || !user.passwordResetExpires) {
    throw httpError("Invalid or expired reset code.", 400);
  }
  if (user.passwordResetExpires < new Date()) {
    throw httpError("This reset code has expired. Please request a new one.", 400);
  }
  if ((user.passwordResetAttempts || 0) >= 5) {
    throw httpError("Too many incorrect attempts. Please request a new code.", 429);
  }
  if (user.passwordResetToken !== sha256(String(code).trim())) {
    user.passwordResetAttempts = (user.passwordResetAttempts || 0) + 1;
    await user.save({ validateBeforeSave: false });
    throw httpError("Invalid or expired reset code.", 400);
  }
  validatePasswordPolicy(newPassword, config);

  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.passwordResetAttempts = 0;
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  const token = generateToken(user, config.security?.sessionDays);
  return { token, user: user.getPublicProfile() };
};

// ── SIGN OUT EVERYWHERE ──────────────────────────────────────────────────
const revokeAllSessions = async (userId) => {
  const user = await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } }, { new: true });
  if (!user) throw httpError("User not found.", 404);
  return user;
};

module.exports = {
  registerUser,
  loginUser,
  changePassword,
  requestPasswordReset,
  resetPassword,
  revokeAllSessions,
  generateToken,
  validatePasswordPolicy,
};
