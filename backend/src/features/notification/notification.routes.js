/**
 * NOTIFICATION ROUTES — notification.routes.js
 * ===============================================
 * Endpoints for retrieving, reading, and deleting notifications.
 */

const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const notificationController = require("./notification.controller");

const router = express.Router();

router.use(authMiddleware.protect);

router.get("/", notificationController.getNotifications);
router.get("/unread-count", notificationController.getUnreadCount);
router.get("/history", notificationController.getHistory);
router.patch("/read-all", notificationController.markAllAsRead);
router.patch("/:id/read", notificationController.markAsRead);
router.delete("/:id", notificationController.deleteNotification);

module.exports = router;
