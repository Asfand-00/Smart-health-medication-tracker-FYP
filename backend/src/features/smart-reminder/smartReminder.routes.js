/**
 * SMART REMINDER ROUTES — smartReminder.routes.js
 * ==================================================
 * Endpoints for the automated and adaptive reminder system.
 */

const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");
const smartReminderController = require("./smartReminder.controller");

const router = express.Router();

router.use(authMiddleware.protect);

// Patients generate and view upcoming/history
router.post("/generate", roleMiddleware.authorize("patient"), smartReminderController.generateReminders);
router.get("/upcoming", roleMiddleware.authorize("patient"), smartReminderController.getUpcomingReminders);
router.post("/acknowledge/:id", roleMiddleware.authorize("patient"), smartReminderController.acknowledgeReminder);
router.get("/history", roleMiddleware.authorize("patient"), smartReminderController.getReminderHistory);
router.get("/suggestions", roleMiddleware.authorize("patient"), smartReminderController.getSuggestions);
router.get("/missed", roleMiddleware.authorize("patient", "caregiver"), smartReminderController.getMissedReminders);

// Escalation trigger (callable by system or manually for testing)
router.post("/escalate/:id", smartReminderController.escalateReminder);

module.exports = router;
