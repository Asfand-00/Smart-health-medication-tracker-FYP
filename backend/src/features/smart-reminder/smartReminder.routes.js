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

// Reminder time preferences (adaptive timing applies here)
router.get("/preferences", roleMiddleware.authorize("patient"), smartReminderController.getPreferences);
router.put("/preferences", roleMiddleware.authorize("patient"), smartReminderController.updatePreferences);
router.post("/suggestions/apply", roleMiddleware.authorize("patient"), smartReminderController.applySuggestion);

// Escalation trigger (admin / system only)
router.post("/escalate/:id", roleMiddleware.authorize("admin"), smartReminderController.escalateReminder);

module.exports = router;
