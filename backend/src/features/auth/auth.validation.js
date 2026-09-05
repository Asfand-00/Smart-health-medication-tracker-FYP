/**
 * AUTH VALIDATION — auth.validation.js
 * ========================================
 * Defines validation rules for register and login requests.
 *
 * WHY validate on the backend?
 * → Frontend validation can be bypassed (e.g., via Postman or curl).
 * → ALWAYS validate on the server. This is a security requirement.
 *
 * We use express-validator for clean, readable validation rules.
 */

const { body } = require("express-validator");

/**
 * registerValidation — rules applied to POST /api/auth/register
 * Each rule validates one field in the request body.
 */
const registerValidation = [
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),

  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(), // converts to lowercase

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters")
    .matches(/\d/)
    .withMessage("Password must contain at least one number"),

  body("role")
    .optional() // Role is optional — defaults to 'patient' in the model
    .isIn(["patient", "caregiver", "doctor", "admin"])
    .withMessage("Role must be: patient, caregiver, doctor, or admin"),
];

/**
 * loginValidation — rules applied to POST /api/auth/login
 */
const loginValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address"),

  body("password")
    .notEmpty()
    .withMessage("Password is required"),
];

module.exports = { registerValidation, loginValidation };
