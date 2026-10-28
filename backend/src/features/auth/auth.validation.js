/**
 * AUTH VALIDATION — auth.validation.js
 * ========================================
 * Defines validation rules for the authentication endpoints.
 * ALWAYS validate on the server — client validation can be bypassed.
 */

const { body } = require("express-validator");

const passwordRules = (field = "password") =>
  body(field)
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters")
    .matches(/\d/)
    .withMessage("Password must contain at least one number");

const registerValidation = [
  body("firstName").trim().notEmpty().withMessage("First name is required").isLength({ min: 2, max: 50 }).withMessage("First name must be between 2 and 50 characters"),
  body("lastName").trim().notEmpty().withMessage("Last name is required").isLength({ min: 2, max: 50 }).withMessage("Last name must be between 2 and 50 characters"),
  body("email").trim().notEmpty().withMessage("Email is required").isEmail().withMessage("Please provide a valid email address").normalizeEmail(),
  passwordRules("password"),
  body("role").optional().isIn(["patient", "caregiver", "doctor", "admin"]).withMessage("Role must be: patient, caregiver, doctor, or admin"),
  body("phone").optional({ values: "falsy" }).isString().trim().isLength({ max: 30 }).withMessage("Phone number is too long"),
];

const loginValidation = [
  body("email").trim().notEmpty().withMessage("Email is required").isEmail().withMessage("Please provide a valid email address"),
  body("password").notEmpty().withMessage("Password is required"),
];

const changePasswordValidation = [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  passwordRules("newPassword"),
];

const forgotPasswordValidation = [
  body("email").trim().notEmpty().withMessage("Email is required").isEmail().withMessage("Please provide a valid email address"),
];

const resetPasswordValidation = [
  body("email").trim().notEmpty().withMessage("Email is required").isEmail().withMessage("Please provide a valid email address"),
  body("code").trim().notEmpty().withMessage("Reset code is required").isLength({ min: 6, max: 6 }).withMessage("The reset code is 6 digits"),
  passwordRules("newPassword"),
];

module.exports = { registerValidation, loginValidation, changePasswordValidation, forgotPasswordValidation, resetPasswordValidation };
