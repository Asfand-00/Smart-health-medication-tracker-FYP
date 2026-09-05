/**
 * EXPRESS APP CONFIGURATION — app.js
 * =====================================
 * This file sets up the Express application:
 * - Loads middleware (cors, json parser, logger)
 * - Registers all API routes
 * - Attaches the global error handler
 *
 * WHY separate app.js from server.js?
 * → app.js defines WHAT the app does (routes, middleware)
 * → server.js defines HOW the app runs (port, DB connection)
 * → This separation makes testing easier — you can import app.js
 *   in test files without actually starting the server.
 */

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

// Import routes (we'll create these next)
const authRoutes = require("./features/auth/auth.routes");
const userRoutes = require("./features/user/user.routes");
const patientRoutes = require("./features/patient/patient.routes");
const medicationRoutes = require("./features/medication/medication.routes");
const vitalsRoutes     = require("./features/vitals/vitals.routes");
const caregiverRoutes  = require("./features/caregiver/caregiver.routes");
const reminderRoutes   = require("./features/reminder/reminder.routes");
const adherenceRoutes  = require("./features/adherence/adherence.routes");
const notificationRoutes = require("./features/notification/notification.routes");
const smartReminderRoutes = require("./features/smart-reminder/smartReminder.routes");
const caregiverDashboardRoutes = require("./features/caregiver/caregiverDashboard.routes");
const reportsRoutes = require("./features/reports/reports.routes");

// Import global error handler middleware
const errorHandler = require("./middleware/errorHandler");

// Create the Express application instance
const app = express();

// ── MIDDLEWARE SETUP ─────────────────────────────────────────────────────

/**
 * CORS (Cross-Origin Resource Sharing)
 * Allows our React frontend (running on port 5173) to talk to this
 * backend (running on port 5000). Without this, browsers block requests.
 */
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true, // Allow cookies/auth headers
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/**
 * express.json() — Body Parser
 * Parses incoming requests with JSON payloads.
 * Without this, req.body would be undefined.
 */
app.use(express.json({ limit: "10mb" }));

/**
 * express.urlencoded()
 * Parses URL-encoded form data (like HTML form submissions).
 */
app.use(express.urlencoded({ extended: true }));

/**
 * Morgan — HTTP Request Logger
 * Logs every request to the console in development.
 * e.g., "POST /api/auth/login 200 45ms"
 * Only enabled in development to avoid noise in production logs.
 */
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ── ROUTES ──────────────────────────────────────────────────────────────

/**
 * Health Check Route
 * Simple endpoint to verify the server is running.
 * Try: GET http://localhost:5000/api/health
 */
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "🏥 Smart Medication Tracker API is running!",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

/**
 * API Routes
 * All routes are prefixed with /api/
 * auth routes  → /api/auth/register, /api/auth/login
 * user routes  → /api/user/profile
 */
app.use("/api/auth",      authRoutes);
app.use("/api/user",      userRoutes);
app.use("/api/patient",   patientRoutes);
app.use("/api/medication",medicationRoutes);
app.use("/api/vitals",    vitalsRoutes);
app.use("/api/caregiver", caregiverRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/adherence", adherenceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/smart-reminders", smartReminderRoutes);
app.use("/api/caregiver-dashboard", caregiverDashboardRoutes);
app.use("/api/reports", reportsRoutes);

/**
 * 404 Handler — Catch-all for unknown routes
 * This runs if no route above matched the request.
 */
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found on this server.`,
  });
});

// ── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────
// MUST be registered LAST, after all other middleware and routes
app.use(errorHandler);

module.exports = app;
