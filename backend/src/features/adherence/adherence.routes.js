/**
 * ADHERENCE ROUTES — adherence.routes.js
 * =========================================
 * Endpoints for medication adherence tracking and analytics.
 */

const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");
const adherenceController = require("./adherence.controller");

const router = express.Router();

router.use(authMiddleware.protect);

// Patient/Caregiver actions
router.post("/confirm", roleMiddleware.authorize("patient", "caregiver"), adherenceController.confirmDose);
router.get("/today", roleMiddleware.authorize("patient", "caregiver", "doctor", "admin"), adherenceController.getTodayStatus);
router.get("/daily/:date", roleMiddleware.authorize("patient", "caregiver", "doctor", "admin"), adherenceController.getDailyReport);
router.get("/weekly", roleMiddleware.authorize("patient", "caregiver", "doctor", "admin"), adherenceController.getWeeklyReport);
router.get("/monthly", roleMiddleware.authorize("patient", "caregiver", "doctor", "admin"), adherenceController.getMonthlyReport);
router.get("/history", roleMiddleware.authorize("patient", "caregiver", "doctor", "admin"), adherenceController.getHistory);
router.get("/export", roleMiddleware.authorize("patient", "caregiver"), adherenceController.exportData);

// Caregiver/Doctor analytics
router.get("/risk-score/:patientId", roleMiddleware.authorize("caregiver", "doctor", "admin"), adherenceController.getRiskScore);
router.get("/predictions/:patientId", roleMiddleware.authorize("caregiver", "doctor", "admin"), adherenceController.getPredictions);
router.get("/patterns/:patientId", roleMiddleware.authorize("caregiver", "doctor", "admin"), adherenceController.getPatterns);

module.exports = router;
