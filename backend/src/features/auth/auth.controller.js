/**
 * AUTH CONTROLLER — auth.controller.js
 * ========================================
 * Controllers handle HTTP requests and send HTTP responses.
 * They are THIN — they delegate all logic to the service layer.
 *
 * PATTERN: Request → Controller → Service → Database → Response
 *
 * Each controller function:
 * 1. Checks for validation errors
 * 2. Calls the service function
 * 3. Sends a JSON response back to the client
 */

const { validationResult } = require("express-validator");
const authService = require("./auth.service");

// ── REGISTER CONTROLLER ──────────────────────────────────────────────────
/**
 * register — handles POST /api/auth/register
 *
 * @param {Request}  req - Express request object (contains req.body)
 * @param {Response} res - Express response object (used to send reply)
 * @param {Function} next - passes errors to the global error handler
 */
const register = async (req, res, next) => {
  try {
    // Step 1: Check if express-validator found any errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Return 422 (Unprocessable Entity) with all validation errors
      return res.status(422).json({
        success: false,
        message: "Validation failed",
        errors: errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
        })),
      });
    }

    // Step 2: Extract user data from request body
    const { firstName, lastName, email, password, role } = req.body;

    // Security: Prevent admin registration via public API
    if (role === 'admin') {
      return res.status(403).json({
        success: false,
        message: "Admin registration is not allowed.",
      });
    }

    // Step 3: Call service to handle registration
    const result = await authService.registerUser({
      firstName,
      lastName,
      email,
      password,
      role,
    });

    // Step 4: Send success response with token and user data
    // 201 = Created (new resource was successfully created)
    res.status(201).json({
      success: true,
      message: "Account created successfully! Welcome to Smart Medication Tracker.",
      data: result,
    });
  } catch (error) {
    // Pass error to global error handler (errorHandler.js)
    next(error);
  }
};

// ── LOGIN CONTROLLER ─────────────────────────────────────────────────────
/**
 * login — handles POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    // Step 1: Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        message: "Validation failed",
        errors: errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
        })),
      });
    }

    // Step 2: Extract credentials from request body
    const { email, password } = req.body;

    // Step 3: Call service to authenticate user
    const result = await authService.loginUser(email, password);

    // Step 4: Send success response
    // 200 = OK
    res.status(200).json({
      success: true,
      message: "Login successful! Welcome back.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET ME CONTROLLER ────────────────────────────────────────────────────
/**
 * getMe — handles GET /api/auth/me
 * Returns the currently logged-in user's data.
 * req.user is set by the authMiddleware after token verification.
 */
const getMe = async (req, res, next) => {
  try {
    // req.user is populated by authMiddleware
    res.status(200).json({
      success: true,
      data: { user: req.user },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe };
