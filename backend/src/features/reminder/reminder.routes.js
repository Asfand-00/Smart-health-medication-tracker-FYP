/**
 * REMINDER ROUTES — reminder.routes.js
 * =======================================
 * Endpoints for reminder and notification management.
 */

const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");
const {
  createReminder,
  pokePatient,
  getMyReminders,
  markAsRead,
  alertCaregiverMissed,
} = require("./reminder.controller");

const router = express.Router();

// All reminder routes require authentication
router.use(authMiddleware.protect);

// Patient routes
router.get("/", roleMiddleware.authorize("patient"), getMyReminders);
router.patch("/:id/read", roleMiddleware.authorize("patient"), markAsRead);
router.post("/alert-caregiver", roleMiddleware.authorize("patient"), alertCaregiverMissed);

// Caregiver routes
router.post("/", roleMiddleware.authorize("caregiver"), createReminder);
router.post("/poke", roleMiddleware.authorize("caregiver"), pokePatient);

module.exports = router;
