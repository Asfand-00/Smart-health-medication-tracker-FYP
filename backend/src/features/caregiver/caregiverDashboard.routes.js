/**
 * CAREGIVER DASHBOARD ROUTES — caregiverDashboard.routes.js
 * ==========================================================
 * Endpoints for retrieving detailed patient metrics, assessments, logs,
 * timeline events, and managing notes or emergency contacts.
 */

const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");
const caregiverDashboardController = require("./caregiverDashboard.controller");

const router = express.Router();

router.use(authMiddleware.protect);

// Overview is only for caregivers
router.get("/overview", roleMiddleware.authorize("caregiver"), caregiverDashboardController.getOverview);

// Alerts is only for caregivers
router.get("/alerts", roleMiddleware.authorize("caregiver"), caregiverDashboardController.getAlerts);

// Patients sub-routes
router.get("/patients/:id/timeline", roleMiddleware.authorize("caregiver", "doctor"), caregiverDashboardController.getPatientTimeline);
router.get("/patients/:id/adherence", roleMiddleware.authorize("caregiver", "doctor"), caregiverDashboardController.getPatientAdherence);

// Notes (Caregivers)
router.post("/notes", roleMiddleware.authorize("caregiver"), caregiverDashboardController.addCaregiverNote);
router.get("/notes/:patientId", roleMiddleware.authorize("caregiver"), caregiverDashboardController.getCaregiverNotes);
router.put("/notes/:id", roleMiddleware.authorize("caregiver"), caregiverDashboardController.updateCaregiverNote);
router.delete("/notes/:id", roleMiddleware.authorize("caregiver"), caregiverDashboardController.deleteCaregiverNote);

// Cognitive assessments (Caregivers/Doctors)
router.post("/cognitive-assessment", roleMiddleware.authorize("caregiver", "doctor"), caregiverDashboardController.logCognitiveAssessment);
router.get("/cognitive-assessments/:patientId", roleMiddleware.authorize("caregiver", "doctor"), caregiverDashboardController.getCognitiveAssessments);

// Behavioral observations (Caregivers)
router.post("/behavioral-observation", roleMiddleware.authorize("caregiver"), caregiverDashboardController.logBehavioralObservation);
router.get("/behavioral-observations/:patientId", roleMiddleware.authorize("caregiver", "doctor"), caregiverDashboardController.getBehavioralObservations);

// Mood tracking (Caregivers / Patients)
router.post("/mood", roleMiddleware.authorize("caregiver", "patient"), caregiverDashboardController.logMood);
router.get("/mood/:patientId", roleMiddleware.authorize("caregiver", "doctor", "patient"), caregiverDashboardController.getMoodHistory);

// Emergency contacts (Caregivers / Patients)
router.post("/emergency-contacts", roleMiddleware.authorize("caregiver", "patient"), caregiverDashboardController.addEmergencyContact);
router.get("/emergency-contacts/:patientId", roleMiddleware.authorize("caregiver", "patient"), caregiverDashboardController.getEmergencyContacts);
router.put("/emergency-contacts/:id", roleMiddleware.authorize("caregiver", "patient"), caregiverDashboardController.updateEmergencyContact);
router.delete("/emergency-contacts/:id", roleMiddleware.authorize("caregiver", "patient"), caregiverDashboardController.deleteEmergencyContact);

module.exports = router;
