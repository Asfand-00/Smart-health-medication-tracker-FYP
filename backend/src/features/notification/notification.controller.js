/**
 * NOTIFICATION CONTROLLER — notification.controller.js
 * =======================================================
 * Request handlers for notification routes.
 */

const notificationService = require("./notification.service");

// GET /api/notifications
exports.getNotifications = async (req, res, next) => {
  try {
    const result = await notificationService.getNotifications(req.user._id, req.query);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// GET /api/notifications/unread-count
exports.getUnreadCount = async (req, res, next) => {
  try {
    const result = await notificationService.getUnreadCount(req.user._id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/notifications/:id/read
exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req.user._id);
    res.status(200).json({ success: true, message: "Notification marked as read", data: notification });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// PATCH /api/notifications/read-all
exports.markAllAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllAsRead(req.user._id);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/notifications/:id
exports.deleteNotification = async (req, res, next) => {
  try {
    const result = await notificationService.deleteNotification(req.params.id, req.user._id);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/notifications/history
exports.getHistory = async (req, res, next) => {
  try {
    const result = await notificationService.getHistory(req.user._id, req.query);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
