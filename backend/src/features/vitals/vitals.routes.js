/**
 * VITALS ROUTES — vitals.routes.js
 * ==================================
 * Endpoints for recording and viewing health vitals.
 */

const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");
const { getLatestVitals, getVitalsHistory, addVitals, deleteVitals, checkTodayVitals } = require("./vitals.controller");

const router = express.Router();

// Protected and patient-only
router.use(authMiddleware.protect);
router.use(roleMiddleware.authorize("patient"));

router.route("/")
  .get(getLatestVitals)
  .post(addVitals);

// IMPORTANT: specific routes like /today-check must come before /:id
router.get("/today-check", checkTodayVitals);
router.get("/history", getVitalsHistory);

router.delete("/:id", deleteVitals);

module.exports = router;
