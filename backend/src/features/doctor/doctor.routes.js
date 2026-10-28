/**
 * DOCTOR ROUTES — doctor.routes.js
 * =================================
 * Patient:
 *   GET  /api/doctor/available            list doctors
 *   POST /api/doctor/request              ask a doctor to supervise me
 *   GET  /api/doctor/my-doctor            my accepted doctors
 *   GET  /api/doctor/my-requests          my sent requests
 * Doctor:
 *   GET  /api/doctor/dashboard            stats
 *   GET  /api/doctor/requests             pending patient requests
 *   POST /api/doctor/requests/:id/handle  accept / decline
 *   GET  /api/doctor/patients             assigned patients + adherence/risk
 *   DELETE /api/doctor/patients/:id       end supervision
 *   GET  /api/doctor/patients/:id/overview
 *   CRUD /api/doctor/patients/:id/medications[/:medId]
 * Notes:
 *   POST /api/doctor/notes · GET /api/doctor/notes/:patientId · PUT/DELETE /api/doctor/notes/:id
 */

const express = require("express");
const { protect } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/roleMiddleware");
const c = require("./doctor.controller");

const router = express.Router();
router.use(protect);

// Patient
router.get("/available", authorize("patient"), c.getAvailableDoctors);
router.post("/request", authorize("patient"), c.requestDoctor);
router.get("/my-doctor", authorize("patient"), c.getMyDoctors);
router.get("/my-requests", authorize("patient"), c.getMyDoctorRequests);

// Doctor
router.get("/dashboard", authorize("doctor"), c.getDashboard);
router.get("/requests", authorize("doctor"), c.getRequests);
router.post("/requests/:id/handle", authorize("doctor"), c.handleRequest);
router.get("/patients", authorize("doctor"), c.getPatients);
router.delete("/patients/:id", authorize("doctor"), c.removePatient);
router.get("/patients/:id/overview", authorize("doctor", "admin"), c.getPatientOverview);
router.get("/patients/:id/medications", authorize("doctor"), c.getPatientMedications);
router.post("/patients/:id/medications", authorize("doctor"), c.addPatientMedication);
router.put("/patients/:id/medications/:medId", authorize("doctor"), c.updatePatientMedication);
router.delete("/patients/:id/medications/:medId", authorize("doctor"), c.deletePatientMedication);

// Notes
router.post("/notes", authorize("doctor"), c.addNote);
router.get("/notes/:patientId", authorize("doctor", "patient", "caregiver", "admin"), c.getNotes);
router.put("/notes/:id", authorize("doctor"), c.updateNote);
router.delete("/notes/:id", authorize("doctor"), c.deleteNote);

module.exports = router;
