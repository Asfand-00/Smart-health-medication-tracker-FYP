/**
 * AUTH ROUTES — auth.routes.js
 * ==============================
 * Defines the URL endpoints for authentication.
 * Each route maps an HTTP method + URL to a controller function.
 *
 * ROUTES:
 * POST /api/auth/register → register a new user
 * POST /api/auth/login    → login and get token
 * GET  /api/auth/me       → get current user (protected)
 */

const express = require("express");
const router = express.Router();

// Import controller functions
const { register, login, getMe } = require("./auth.controller");

// Import validation rules
const { registerValidation, loginValidation } = require("./auth.validation");

// Import auth middleware (for protected route)
const { protect } = require("../../middleware/authMiddleware");

/**
 * Route: POST /api/auth/register
 * Middleware chain: [validate inputs] → [register controller]
 */
router.post("/register", registerValidation, register);

/**
 * Route: POST /api/auth/login
 * Middleware chain: [validate inputs] → [login controller]
 */
router.post("/login", loginValidation, login);

/**
 * Route: GET /api/auth/me
 * Protected — requires valid JWT token in Authorization header
 * Middleware chain: [verify token] → [getMe controller]
 */
router.get("/me", protect, getMe);

module.exports = router;
