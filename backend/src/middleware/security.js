/**
 * SECURITY MIDDLEWARE — security.js
 * ==================================
 *  - helmet: secure HTTP headers (HSTS, no-sniff, frame denial, ...)
 *  - rate limiters: brute-force protection for auth endpoints and a general
 *    per-IP ceiling for the API
 *  - maintenanceGate: when the admin enables maintenance mode, everyone but
 *    administrators receives 503
 */

const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const securityHeaders = helmet({
  // The API serves JSON (and encrypted file downloads); no inline scripts to allow.
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

const skipInTests = () => process.env.DISABLE_RATE_LIMIT === "true";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: skipInTests,
  message: { success: false, message: "Too many attempts from this address. Please wait 15 minutes and try again." },
});

const recoveryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: skipInTests,
  message: { success: false, message: "Too many recovery requests. Please try again later." },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: skipInTests,
  message: { success: false, message: "Too many requests. Please slow down." },
});

/** Must run after `protect` so req.user is known; unauthenticated requests are judged by path. */
const maintenanceGate = async (req, res, next) => {
  try {
    if (req.path === "/api/health") return next();
    const SystemConfig = require("../features/admin/systemConfig.model");
    const config = await SystemConfig.getConfig();
    if (!config.maintenanceMode) return next();
    // Admins keep working so they can switch it off again; login must stay open for them.
    if (req.user?.role === "admin" || req.path.startsWith("/api/auth/login") || req.path.startsWith("/api/auth/me") || req.path.startsWith("/api/admin")) {
      return next();
    }
    return res.status(503).json({ success: false, maintenance: true, message: config.maintenanceMessage });
  } catch (err) {
    next(err);
  }
};

module.exports = { securityHeaders, authLimiter, recoveryLimiter, apiLimiter, maintenanceGate };
