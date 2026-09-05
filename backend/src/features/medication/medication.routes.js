/**
 * MEDICATION ROUTES — medication.routes.js
 * ==========================================
 * Endpoints for medication management and history tracking.
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
  getMedicationStats
} = require("./medication.controller");

const router = express.Router();

// All medication routes are protected and restricted to 'patient' role for now
// In the future, 'caregiver' or 'doctor' might be granted read access
router.use(authMiddleware.protect);
router.use(roleMiddleware.authorize("patient"));

// Base routes
router.route("/")
  .get(getMedications)
  .post(addMedication);

// History and Stats routes MUST be defined before /:id
router.route("/history")
  .get(getMedicationHistory);

router.route("/stats")
  .get(getMedicationStats);

// Routes specific to a medication ID
router.route("/:id")
  .put(updateMedication)
  .delete(deleteMedication);

// Logging a dose
router.route("/:id/log")
  .post(logMedication);

module.exports = router;
