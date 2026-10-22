/**
 * PATIENT ROUTES — patient.routes.js
 * ===================================
 * GET/PUT /api/patient/profile                 own profile (patient)
 * GET     /api/patient/:userId/profile         care-team view
 * GET/POST /api/patient/conditions             own conditions (patient)
 * PUT/DELETE /api/patient/conditions/:id
 * GET/POST /api/patient/:userId/conditions     care-team (caregiver/doctor)
 * PUT/DELETE /api/patient/:userId/conditions/:id
 */

const express = require("express");
const c = require("./patient.controller");
const { protect } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/roleMiddleware");

const router = express.Router();
router.use(protect);

router.get("/profile", authorize("patient"), c.getProfile);
router.put("/profile", authorize("patient"), c.upsertProfile);

router.get("/conditions", authorize("patient"), c.listConditions);
router.post("/conditions", authorize("patient"), c.addCondition);
router.put("/conditions/:id", authorize("patient"), c.updateCondition);
router.delete("/conditions/:id", authorize("patient"), c.deleteCondition);

router.get("/:userId/profile", authorize("caregiver", "doctor", "admin"), c.getProfileFor);
router.get("/:userId/conditions", authorize("caregiver", "doctor", "admin"), c.listConditions);
router.post("/:userId/conditions", authorize("caregiver", "doctor"), c.addCondition);
router.put("/:userId/conditions/:id", authorize("caregiver", "doctor"), c.updateCondition);
router.delete("/:userId/conditions/:id", authorize("caregiver", "doctor"), c.deleteCondition);

module.exports = router;
