/**
 * ADMIN ROUTES — admin.routes.js
 * ===============================
 * Everything under /api/admin requires the admin role.
 *
 * Monitoring   GET /dashboard · GET /health-checks · POST /jobs/:name
 * Users        GET /users · POST /users · GET /users/:id · PUT /users/:id/status
 *              PUT /users/:id/role · POST /users/:id/reset-password · POST /users/:id/unlock
 * Alerts       POST /notifications/broadcast · GET /notifications · DELETE /notifications/:id · GET /alerts
 * Reporting    GET /reports/overview · GET /reports/export?type=
 * Config       GET /config · PUT /config
 * (Audit logs live under /api/audit.)
 */

const express = require("express");
const { protect } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/roleMiddleware");
const c = require("./admin.controller");

const router = express.Router();
router.use(protect, authorize("admin"));

router.get("/dashboard", c.getDashboard);
router.get("/health-checks", c.getHealthChecks);
router.post("/jobs/:name", c.runJob);

router.route("/users").get(c.listUsers).post(c.createUser);
router.get("/users/:id", c.getUser);
router.put("/users/:id/status", c.setStatus);
router.put("/users/:id/role", c.setRole);
router.post("/users/:id/reset-password", c.resetUserPassword);
router.post("/users/:id/unlock", c.unlockUser);

router.post("/notifications/broadcast", c.broadcast);
router.get("/notifications", c.listNotifications);
router.delete("/notifications/:id", c.deleteNotification);
router.get("/alerts", c.listAlerts);

router.get("/reports/overview", c.reportsOverview);
router.get("/reports/export", c.reportsExport);

router.route("/config").get(c.getConfig).put(c.updateConfig);

module.exports = router;
