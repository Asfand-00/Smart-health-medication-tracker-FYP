/**
 * PATIENT ROUTES — patient.routes.js
 * ===================================
 * Defines the endpoints for patient profile management.
 */

const express = require("express");
const { getProfile, upsertProfile } = require("./patient.controller");
const { protect } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/roleMiddleware");

const router = express.Router();

// All routes below this line are protected (require login)
router.use(protect);

// Only users with the 'patient' role can access these profile routes
// (A doctor/admin would access patients through a different endpoint, e.g., /api/doctor/patients/:id)
router.use(authorize("patient"));

// ── ROUTES ──────────────────────────────────────────────────────────────
router.get("/profile", getProfile);
router.put("/profile", upsertProfile); // PUT is often used for update/replace

module.exports = router;
