/**
 * REPORTS ROUTES — reports.routes.js
 * =====================================
 * Endpoints for generating medication adherence, details, risk analyses,
 * and exporting structured patient report documents.
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

module.exports = router;
