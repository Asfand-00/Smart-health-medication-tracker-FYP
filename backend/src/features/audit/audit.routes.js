/**
 * AUDIT ROUTES — audit.routes.js
 * ===============================
 * GET /api/audit         → admin: all access logs (filters + pagination)
 * GET /api/audit/stats   → admin: counts for the last N days
 * GET /api/audit/me      → any user: their own activity trail
 */

const express = require("express");
const { protect } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/roleMiddleware");
const auditService = require("./audit.service");

const router = express.Router();
router.use(protect);

router.get("/me", async (req, res, next) => {
  try {
    const result = await auditService.list({ ...req.query, userId: req.user._id });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get("/stats", authorize("admin"), async (req, res, next) => {
  try {
    const result = await auditService.stats(parseInt(req.query.days, 10) || 7);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get("/", authorize("admin"), async (req, res, next) => {
  try {
    const result = await auditService.list(req.query);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
