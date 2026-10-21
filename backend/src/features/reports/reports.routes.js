/**
 * REPORTS ROUTES — reports.routes.js
 * =====================================
 * GET /api/reports/adherence · /medications · /risk-analysis · /export/pdf
 * GET /api/reports/health-trends?days= · /insights?days= · /performance?months=
 * GET /api/reports/export/csv?type=vitals|medications|mood|full
 * All accept ?patientId= for caregivers / doctors / admins.
 */

const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const reportsController = require("./reports.controller");

const router = express.Router();

router.use(authMiddleware.protect);

router.get("/adherence", reportsController.getAdherenceReport);
router.get("/medications", reportsController.getMedicationsReport);
router.get("/risk-analysis", reportsController.getRiskAnalysisReport);
router.get("/export/pdf", reportsController.exportPdfReadyData);
router.get("/export/csv", reportsController.exportCsv);
router.get("/health-trends", reportsController.getHealthTrends);
router.get("/insights", reportsController.getInsights);
router.get("/performance", reportsController.getPerformance);

module.exports = router;
