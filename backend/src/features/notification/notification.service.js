/**
 * NOTIFICATION SERVICE — notification.service.js
 * ==================================================
 * Creates notifications and fans them out over every channel the user has
 * enabled: in-app (socket), email, OS push (Expo) and SMS (Twilio or mock).
 *
 * Delivery rules
 *  - the user's NotificationSettings decide which types and channels apply
 *  - platform SystemConfig can switch email / sms / push off globally
 *  - during quiet hours only critical alerts reach push / sms / email;
 *    everything is still stored in-app
 *  - every attempt is recorded in `deliveries` for the history view
 */

const Notification = require("./notification.model");
const NotificationSettings = require("./notificationSettings.model");
const PushToken = require("./pushToken.model");
const User = require("../user/user.model");
const SystemConfig = require("../admin/systemConfig.model");
const { sendEmail } = require("../../utils/email");
const { sendPush } = require("../../utils/push");
const { sendSms } = require("../../utils/sms");

const emailHtml = (title, message) => {
  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
  });
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 25px;">
        <h2 style="color: #1e3a8a; margin: 0; font-weight: 800; font-size: 24px;">Smart Medication Health Tracker</h2>
      </div>
      <h3 style="color: #1e293b; margin-top: 0; font-size: 20px; font-weight: 700;">${title}</h3>
      <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px 20px; border-radius: 8px; margin: 20px 0; font-size: 14px; color: #475569;">
        <strong style="color: #1e3a8a;">📅 Date:</strong> ${formattedDate}
      </div>
      <p style="color: #334155; font-size: 16px; line-height: 1.6;">${message}</p>
      <div style="margin-top: 30px; padding: 15px; background-color: #f8fafc; border-radius: 12px; font-size: 12px; color: #64748b; text-align: center;">
        This is an automated notification. You can change what you receive in the app under Settings → Notifications.
      </div>
    </div>`;
};

/**
 * Create a new notification and deliver it.
 *
 * channel: "in_app" | "email" | "both" | "all"
 *   both → in-app + email (legacy callers)   all → every channel the user allows
 * Push and SMS are attempted for "both"/"all" and for high/critical priority.
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
  broadcastId = null,
  io = null,
}) => {
  const [settings, config, user] = await Promise.all([
    NotificationSettings.getOrCreate(userId),
    SystemConfig.getConfig(),
    User.findById(userId).select("email phone firstName isActive"),
  ]);

  const deliveries = [];
  const isCritical = priority === "critical";
  const isUrgent = priority === "critical" || priority === "high";
  const typeEnabled = settings.types?.[type] !== false;
  const quiet = settings.isQuietNow() && !isCritical;

  const notification = await Notification.create({
    userId, type, title, message, channel, priority, relatedModel, relatedId, fromUserId, metadata, broadcastId,
    deliveries: [{ channel: "in_app", status: settings.channels.inApp === false && !isUrgent ? "skipped" : "sent", detail: settings.channels.inApp === false && !isUrgent ? "in-app disabled by user" : "" }],
  });

  if (!user || !user.isActive) return notification;

  const wantsEmail = channel === "email" || channel === "both" || channel === "all";
  const wantsPushSms = channel === "both" || channel === "all" || isUrgent;

  // ── Email ────────────────────────────────────────────────────────────
  if (wantsEmail) {
    if (!config.channels.emailEnabled) deliveries.push({ channel: "email", status: "skipped", detail: "email disabled by administrator" });
    else if (!typeEnabled) deliveries.push({ channel: "email", status: "skipped", detail: `${type} alerts turned off by user` });
    else if (!settings.channels.email) deliveries.push({ channel: "email", status: "skipped", detail: "email turned off by user" });
    else if (quiet && !isUrgent) deliveries.push({ channel: "email", status: "skipped", detail: "quiet hours" });
    else if (!user.email) deliveries.push({ channel: "email", status: "skipped", detail: "no email address" });
    else {
      const result = await sendEmail({ to: user.email, subject: title, text: message, html: emailHtml(title, message) });
      deliveries.push({ channel: "email", status: result?.error ? "failed" : result?.mock ? "mock" : "sent", detail: result?.error || "" });
    }
  }

  // ── Push ─────────────────────────────────────────────────────────────
  if (wantsPushSms) {
    if (!config.channels.pushEnabled) deliveries.push({ channel: "push", status: "skipped", detail: "push disabled by administrator" });
    else if (!typeEnabled) deliveries.push({ channel: "push", status: "skipped", detail: `${type} alerts turned off by user` });
    else if (!settings.channels.push) deliveries.push({ channel: "push", status: "skipped", detail: "push turned off by user" });
    else if (quiet) deliveries.push({ channel: "push", status: "skipped", detail: "quiet hours" });
    else {
      try {
        const result = await sendPush({ userId, title, body: message, data: { type, notificationId: notification._id.toString(), relatedModel, relatedId }, priority: isUrgent ? "high" : "default" });
        deliveries.push({ channel: "push", status: result.skipped ? "skipped" : result.sent > 0 ? (result.results?.every((r) => r.mock) ? "mock" : "sent") : "failed", detail: result.reason || "" });
      } catch (err) {
        deliveries.push({ channel: "push", status: "failed", detail: err.message });
      }
    }
  }

  // ── SMS (urgent only, opt-in) ────────────────────────────────────────
  if (wantsPushSms && isUrgent) {
    const phone = settings.smsPhone || user.phone;
    if (!config.channels.smsEnabled) deliveries.push({ channel: "sms", status: "skipped", detail: "sms disabled by administrator" });
    else if (!settings.channels.sms) deliveries.push({ channel: "sms", status: "skipped", detail: "sms turned off by user" });
    else if (!typeEnabled) deliveries.push({ channel: "sms", status: "skipped", detail: `${type} alerts turned off by user` });
    else if (quiet) deliveries.push({ channel: "sms", status: "skipped", detail: "quiet hours" });
    else if (!phone) deliveries.push({ channel: "sms", status: "skipped", detail: "no phone number" });
    else {
      try {
        const result = await sendSms({ to: phone, body: `${title}: ${message}`.slice(0, 320) });
        deliveries.push({ channel: "sms", status: result.mock ? "mock" : result.skipped ? "skipped" : "sent", detail: result.reason || "" });
      } catch (err) {
        deliveries.push({ channel: "sms", status: "failed", detail: err.message });
      }
    }
  }

  if (deliveries.length) {
    notification.deliveries.push(...deliveries);
    await notification.save();
  }

  // ── Real-time in-app ─────────────────────────────────────────────────
  if (io) {
    io.to(userId.toString()).emit("new_notification", notification);
  }

  return notification;
};

/** Get user's notifications (paginated) */
const getNotifications = async (userId, { page = 1, limit = 20, isRead, type, priority }) => {
  const query = { userId };
  if (isRead !== undefined) query.isRead = isRead === "true" || isRead === true;
  if (type) query.type = type;
  if (priority) query.priority = priority;

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const total = await Notification.countDocuments(query);
  const notifications = await Notification.find(query)
    .populate("fromUserId", "firstName lastName avatar")
    .sort({ createdAt: -1 })
    .skip((p - 1) * l)
    .limit(l);
  return { notifications, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
};

const getUnreadCount = async (userId) => ({ unreadCount: await Notification.countDocuments({ userId, isRead: false }) });

const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOneAndUpdate({ _id: notificationId, userId }, { isRead: true, readAt: new Date() }, { new: true });
  if (!notification) throw { status: 404, message: "Notification not found or access denied." };
  return notification;
};

const markAllAsRead = async (userId) => {
  await Notification.updateMany({ userId, isRead: false }, { isRead: true, readAt: new Date() });
  return { success: true, message: "All notifications marked as read." };
};

const deleteNotification = async (notificationId, userId) => {
  const result = await Notification.deleteOne({ _id: notificationId, userId });
  if (result.deletedCount === 0) throw { status: 404, message: "Notification not found or access denied." };
  return { success: true, message: "Notification deleted." };
};

const getHistory = async (userId, { type, priority, startDate, endDate, isRead, page = 1, limit = 20 }) => {
  const query = { userId };
  if (type) query.type = type;
  if (priority) query.priority = priority;
  if (isRead !== undefined && isRead !== "") query.isRead = isRead === "true" || isRead === true;
  if (startDate && endDate) query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const total = await Notification.countDocuments(query);
  const notifications = await Notification.find(query)
    .populate("fromUserId", "firstName lastName avatar")
    .sort({ createdAt: -1 })
    .skip((p - 1) * l)
    .limit(l);
  return { notifications, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
};

// ── Settings ────────────────────────────────────────────────────────────
const getSettings = async (userId) => NotificationSettings.getOrCreate(userId);

const updateSettings = async (userId, body) => {
  const settings = await NotificationSettings.getOrCreate(userId);
  const merge = (target, source, keys) => {
    if (!source || typeof source !== "object") return;
    keys.forEach((k) => {
      if (source[k] !== undefined) target[k] = source[k];
    });
  };
  merge(settings.channels, body.channels, ["inApp", "email", "push", "sms"]);
  merge(settings.types, body.types, Object.keys(settings.types.toObject ? settings.types.toObject() : settings.types));
  merge(settings.quietHours, body.quietHours, ["enabled", "start", "end"]);
  merge(settings.reminderTimes, body.reminderTimes, ["Morning", "Afternoon", "Evening", "Night"]);
  ["reminderLeadMinutes", "voiceAlerts", "smsPhone", "dailySummaryEmail"].forEach((k) => {
    if (body[k] !== undefined) settings[k] = body[k];
  });
  await settings.save();
  return settings;
};

// ── Push tokens ─────────────────────────────────────────────────────────
const registerPushToken = async (userId, { token, platform, deviceName }) => {
  if (!token || typeof token !== "string") throw { status: 400, message: "token is required." };
  const doc = await PushToken.findOneAndUpdate(
    { token },
    { userId, token, platform: ["ios", "android", "web"].includes(platform) ? platform : "unknown", deviceName: deviceName || "", lastSeenAt: new Date() },
    { upsert: true, new: true }
  );
  return doc;
};

const removePushToken = async (userId, token) => {
  const result = token ? await PushToken.deleteOne({ userId, token }) : await PushToken.deleteMany({ userId });
  return { removed: result.deletedCount };
};

const listPushTokens = async (userId) => PushToken.find({ userId }).select("token platform deviceName lastSeenAt");

module.exports = {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getHistory,
  getSettings,
  updateSettings,
  registerPushToken,
  removePushToken,
  listPushTokens,
};
