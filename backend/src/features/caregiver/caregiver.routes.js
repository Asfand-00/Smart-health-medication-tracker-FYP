/**
 * CAREGIVER ROUTES — caregiver.routes.js
 * ========================================
 * Handles the patient-caregiver relationship.
 */

const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");
const caregiverController = require("./caregiver.controller");

const router = express.Router();

router.use(authMiddleware.protect);

// ── PATIENT ROUTES ──────────────────────────────────────────────
// Only patients can access these routes
router.get("/available", roleMiddleware.authorize("patient"), caregiverController.getAvailableCaregivers);
router.post("/request", roleMiddleware.authorize("patient"), caregiverController.requestCaregiver);
router.get("/my-team", roleMiddleware.authorize("patient"), caregiverController.getMyCareTeam);
router.get("/patient-requests", roleMiddleware.authorize("patient"), caregiverController.getPatientRequests);


// ── CAREGIVER ROUTES ─────────────────────────────────────────────
// Only caregivers can access these routes
router.get("/requests", roleMiddleware.authorize("caregiver"), caregiverController.getCaregiverRequests);
router.post("/requests/:id/handle", roleMiddleware.authorize("caregiver"), caregiverController.handleRequest);
router.get("/patients", roleMiddleware.authorize("caregiver"), caregiverController.getCaregiverPatients);
router.delete("/patients/:id", roleMiddleware.authorize("caregiver"), caregiverController.removePatient);
router.get("/patients/:id/records", roleMiddleware.authorize("caregiver"), caregiverController.getPatientRecords);
router.get("/patients/:id/medications", roleMiddleware.authorize("caregiver"), caregiverController.getPatientMedications);
router.post("/patients/:id/medications", roleMiddleware.authorize("caregiver"), caregiverController.addPatientMedication);
router.put("/patients/:id/medications/:medId", roleMiddleware.authorize("caregiver"), caregiverController.updatePatientMedication);
router.delete("/patients/:id/medications/:medId", roleMiddleware.authorize("caregiver"), caregiverController.deletePatientMedication);
router.post("/patients/:id/medications/:medId/log", roleMiddleware.authorize("caregiver"), caregiverController.logPatientMedication);

module.exports = router;
