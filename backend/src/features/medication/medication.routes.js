/**
 * MEDICATION ROUTES — medication.routes.js
 * ==========================================
 * Endpoints for medication management, history tracking, the calendar view
 * and drug information.
 *
 * Calendar / drug-info / interactions are available to patients (own data)
 * and to caregivers, doctors and admins with ?patientId= (access checked).
 */

const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");
const {
  getMedications,
  addMedication,
  updateMedication,
  deleteMedication,
  logMedication,
  getMedicationHistory,
  getMedicationStats,
  getCalendar,
  getDrugInfo,
  searchDrugInfo,
  getInteractions,
} = require("./medication.controller");

const router = express.Router();

router.use(authMiddleware.protect);

// Shared (any role, access to the patient is verified inside)
router.get("/calendar", getCalendar);
router.get("/drug-info", searchDrugInfo);
router.get("/drug-info/:name", getDrugInfo);
router.get("/interactions", getInteractions);

// Patient-only management routes
router.use(roleMiddleware.authorize("patient"));

router.route("/").get(getMedications).post(addMedication);

// History and Stats routes MUST be defined before /:id
router.route("/history").get(getMedicationHistory);
router.route("/stats").get(getMedicationStats);

router.route("/:id").put(updateMedication).delete(deleteMedication);
router.route("/:id/log").post(logMedication);

module.exports = router;
