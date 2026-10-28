/**
 * PUSH UTILITY — push.js
 * =======================
 * Sends OS push notifications through Expo's push service to every device
 * token a user has registered (POST /api/notifications/push-token).
 * Tokens that Expo reports as invalid are removed automatically.
 */

const { Expo } = require("expo-server-sdk");
const PushToken = require("../features/notification/pushToken.model");

const expo = new Expo();

const sendPush = async ({ userId, title, body, data = {}, priority = "default" }) => {
  const tokens = await PushToken.find({ userId });
  if (tokens.length === 0) return { sent: 0, skipped: true, reason: "no device tokens" };

  const messages = [];
  const results = [];
  for (const t of tokens) {
    if (!Expo.isExpoPushToken(t.token)) {
      // Non-Expo token (e.g. a test token) — log instead of calling Expo.
      console.log(`\n📲 [MOCK PUSH] to ${t.token}: ${title} — ${body}\n`);
      results.push({ token: t.token, mock: true });
      continue;
    }
    messages.push({ to: t.token, sound: "default", title, body, data, priority: priority === "high" ? "high" : "default" });
  }

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        results.push({ token: chunk[i].to, status: ticket.status, error: ticket.details?.error });
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
          PushToken.deleteOne({ token: chunk[i].to }).catch(() => {});
        }
      });
    } catch (err) {
      results.push({ error: err.message });
    }
  }
  return { sent: results.filter((r) => r.status === "ok" || r.mock).length, results };
};

module.exports = { sendPush };
