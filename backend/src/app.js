/**
 * EXPRESS APP CONFIGURATION — app.js
 * =====================================
 * This file sets up the Express application:
 * - Security headers, CORS, rate limiting, maintenance gate
 * - Body parsing and request logging
 * - Registers all API routes
 * - Access-log auditing of every state-changing request
 * - Attaches the global error handler
 *
 * app.js defines WHAT the app does (routes, middleware);
 * server.js defines HOW the app runs (port, DB connection, sockets).
 */

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

// Routes
const authRoutes = require("./features/auth/auth.routes");
const userRoutes = require("./features/user/user.routes");
const patientRoutes = require("./features/patient/patient.routes");
const medicationRoutes = require("./features/medication/medication.routes");
const vitalsRoutes = require("./features/vitals/vitals.routes");
const caregiverRoutes = require("./features/caregiver/caregiver.routes");
const reminderRoutes = require("./features/reminder/reminder.routes");
const adherenceRoutes = require("./features/adherence/adherence.routes");
const notificationRoutes = require("./features/notification/notification.routes");
const smartReminderRoutes = require("./features/smart-reminder/smartReminder.routes");
const caregiverDashboardRoutes = require("./features/caregiver/caregiverDashboard.routes");
const reportsRoutes = require("./features/reports/reports.routes");
const doctorRoutes = require("./features/doctor/doctor.routes");
const prescriptionRoutes = require("./features/prescription/prescription.routes");
const { plans: medicationPlanRoutes, templates: medicationTemplateRoutes } = require("./features/medication-plan/medicationPlan.routes");
const aiRoutes = require("./features/ai/ai.routes");
const auditRoutes = require("./features/audit/audit.routes");
const adminRoutes = require("./features/admin/admin.routes");

// Middleware
const errorHandler = require("./middleware/errorHandler");
const { securityHeaders, apiLimiter, maintenanceGate } = require("./middleware/security");
const { optionalAuth } = require("./middleware/authMiddleware");
const { requestLogger } = require("./features/audit/audit.service");

const app = express();

// Behind a reverse proxy (HTTPS termination) the real client IP is in X-Forwarded-For
app.set("trust proxy", 1);

// ── SECURITY & PARSING ─────────────────────────────────────────────────
app.use(securityHeaders);

/**
 * CORS: the mobile app does not send an Origin header, so it is unaffected.
 * Browsers (Expo web build, admin tools) are limited to CLIENT_URL(S).
 */
const allowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || "http://localhost:5173,http://localhost:8081")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use("/api", apiLimiter);
app.use(optionalAuth);
app.use(maintenanceGate);
app.use(requestLogger);

// ── ROUTES ──────────────────────────────────────────────────────────────

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "🏥 Smart Medication Tracker API is running!",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/patient", patientRoutes);
app.use("/api/medication", medicationRoutes);
app.use("/api/vitals", vitalsRoutes);
app.use("/api/caregiver", caregiverRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/adherence", adherenceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/smart-reminders", smartReminderRoutes);
app.use("/api/caregiver-dashboard", caregiverDashboardRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/medication-plans", medicationPlanRoutes);
app.use("/api/medication-templates", medicationTemplateRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/admin", adminRoutes);

// 404 — catch-all for unknown routes
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found on this server.`,
  });
});

// Global error handler — MUST be registered last
app.use(errorHandler);

module.exports = app;
