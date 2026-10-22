/**
 * NOTIFICATION ROUTES — notification.routes.js
 * ===============================================
 * Inbox, history, alert customisation and push-token registration.
 */

const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const notificationController = require("./notification.controller");

const router = express.Router();

router.use(authMiddleware.protect);

router.get("/", notificationController.getNotifications);
router.get("/unread-count", notificationController.getUnreadCount);
router.get("/history", notificationController.getHistory);
router.route("/settings").get(notificationController.getSettings).put(notificationController.updateSettings);
router.get("/push-tokens", notificationController.listPushTokens);
router.route("/push-token").post(notificationController.registerPushToken).delete(notificationController.removePushToken);
router.post("/test", notificationController.sendTest);
router.patch("/read-all", notificationController.markAllAsRead);
router.patch("/:id/read", notificationController.markAsRead);
router.delete("/:id", notificationController.deleteNotification);

module.exports = router;
