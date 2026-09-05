/**
 * NOTIFICATION SERVICE — notification.service.js
 * ==================================================
 * Business logic for sending and managing notifications.
 * Supports in-app real-time socket events and mocked email alerts.
 */

const Notification = require("./notification.model");
const User = require("../user/user.model");

/**
 * Create a new notification
 */
const createNotification = async ({
  userId,
  type,
  title,
  message,
  channel = "in_app",
  priority = "normal",
  relatedModel = null,
  relatedId = null,
  fromUserId = null,
  metadata = {},
  io = null // Pass optional socket.io instance
}) => {
  const notification = await Notification.create({
    userId,
    type,
    title,
    message,
    channel,
    priority,
    relatedModel,
    relatedId,
    fromUserId,
    metadata,
  });

  // If email channel is requested, send a real email (with mock fallback inside the email utility)
  if (channel === "email" || channel === "both") {
    const user = await User.findById(userId);
    if (user && user.email) {
      const emailService = require("../../utils/email");
      const formattedDate = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
      const htmlBody = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
          <div style="text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 25px;">
            <h2 style="color: #1e3a8a; margin: 0; font-weight: 800; font-size: 24px;">Smart Mental Health Tracker</h2>
          </div>
          <h3 style="color: #e11d48; margin-top: 0; font-size: 20px; font-weight: 700;">
            ⚠️ ${title}
          </h3>
          <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px 20px; border-radius: 8px; margin: 20px 0; font-size: 14px; color: #475569; line-height: 1.5;">
            <strong style="color: #1e3a8a;">📅 Date of Event:</strong> ${formattedDate}
          </div>
          <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">${message}</p>
          <div style="margin-top: 30px; padding: 15px; background-color: #f8fafc; border-radius: 12px; font-size: 12px; color: #64748b; text-align: center; border: 1px solid #f1f5f9;">
            This is an automated clinical notification. Please do not reply directly to this email.
          </div>
        </div>
      `;
      await emailService.sendEmail({
        to: user.email,
        subject: title,
        text: message,
        html: htmlBody
      });
    }
  }

  // Real-time emission if io instance and channel includes in-app
  if (io && (channel === "in_app" || channel === "both")) {
    io.to(userId.toString()).emit("new_notification", notification);
  }

  return notification;
};

/**
 * Get user's notifications (paginated)
 */
const getNotifications = async (userId, { page = 1, limit = 20, isRead }) => {
  const query = { userId };
  if (isRead !== undefined) {
    query.isRead = isRead === "true" || isRead === true;
  }

  const total = await Notification.countDocuments(query);
  const notifications = await Notification.find(query)
    .populate("fromUserId", "firstName lastName avatar")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return {
    notifications,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Get unread count
 */
const getUnreadCount = async (userId) => {
  const count = await Notification.countDocuments({ userId, isRead: false });
  return { unreadCount: count };
};

/**
 * Mark one notification as read
 */
const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
  if (!notification) {
    throw { status: 404, message: "Notification not found or access denied." };
  }
  return notification;
};

/**
 * Mark all notifications as read
 */
const markAllAsRead = async (userId) => {
  await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  return { success: true, message: "All notifications marked as read." };
};

/**
 * Delete a notification
 */
const deleteNotification = async (notificationId, userId) => {
  const result = await Notification.deleteOne({ _id: notificationId, userId });
  if (result.deletedCount === 0) {
    throw { status: 404, message: "Notification not found or access denied." };
  }
  return { success: true, message: "Notification deleted." };
};

/**
 * Get full notification history with optional filters
 */
const getHistory = async (userId, { type, priority, startDate, endDate, page = 1, limit = 20 }) => {
  const query = { userId };
  if (type) query.type = type;
  if (priority) query.priority = priority;
  if (startDate && endDate) {
    query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const total = await Notification.countDocuments(query);
  const notifications = await Notification.find(query)
    .populate("fromUserId", "firstName lastName avatar")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return {
    notifications,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

module.exports = {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getHistory,
};
