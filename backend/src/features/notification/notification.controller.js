/**
 * NOTIFICATION CONTROLLER — notification.controller.js
 * =======================================================
 * Request handlers for notification routes, alert customisation and
 * push-token registration.
 */

const notificationService = require("./notification.service");

const handle = (res, next, error) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  next(error);
};

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
    handle(res, next, error);
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
    handle(res, next, error);
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

// GET /api/notifications/settings
exports.getSettings = async (req, res, next) => {
  try {
    const settings = await notificationService.getSettings(req.user._id);
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

// PUT /api/notifications/settings
exports.updateSettings = async (req, res, next) => {
  try {
    const settings = await notificationService.updateSettings(req.user._id, req.body || {});
    res.status(200).json({ success: true, message: "Notification settings saved.", data: settings });
  } catch (error) {
    next(error);
  }
};

// POST /api/notifications/push-token
exports.registerPushToken = async (req, res, next) => {
  try {
    const token = await notificationService.registerPushToken(req.user._id, req.body || {});
    res.status(200).json({ success: true, message: "Device registered for push notifications.", data: token });
  } catch (error) {
    handle(res, next, error);
  }
};

// DELETE /api/notifications/push-token
exports.removePushToken = async (req, res, next) => {
  try {
    const result = await notificationService.removePushToken(req.user._id, req.body?.token || req.query.token);
    res.status(200).json({ success: true, message: "Device unregistered.", data: result });
  } catch (error) {
    next(error);
  }
};

// GET /api/notifications/push-tokens
exports.listPushTokens = async (req, res, next) => {
  try {
    const tokens = await notificationService.listPushTokens(req.user._id);
    res.status(200).json({ success: true, data: tokens });
  } catch (error) {
    next(error);
  }
};

// POST /api/notifications/test — send myself a test alert on every channel
exports.sendTest = async (req, res, next) => {
  try {
    const notification = await notificationService.createNotification({
      userId: req.user._id,
      type: "system",
      title: "🔔 Test notification",
      message: req.body?.message || "This is a test alert from Smart Medication Tracker. If you can read this, notifications are working.",
      priority: req.body?.priority === "high" ? "high" : "normal",
      channel: "all",
      io: req.app.locals.io,
    });
    res.status(200).json({ success: true, message: "Test notification sent.", data: notification });
  } catch (error) {
    next(error);
  }
};
