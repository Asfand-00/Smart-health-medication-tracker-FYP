/**
 * SMS UTILITY — sms.js
 * =====================
 * Sends SMS through Twilio's REST API when TWILIO_ACCOUNT_SID,
 * TWILIO_AUTH_TOKEN and TWILIO_FROM are configured; otherwise logs a mock
 * message so the rest of the pipeline (preferences, delivery history) can be
 * exercised without an account. No SDK needed — plain HTTPS.
 */

const isConfigured = () =>
  Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);

const sendSms = async ({ to, body }) => {
  if (!to) return { skipped: true, reason: "no phone number" };

  if (!isConfigured()) {
    console.log(`\n📱 [MOCK SMS] to ${to}: ${body}\n`);
    return { mock: true, to };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const params = new URLSearchParams({ To: to, From: process.env.TWILIO_FROM, Body: body });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Twilio error ${res.status}`);
  return { sid: json.sid, to };
};

module.exports = { sendSms, isSmsConfigured: isConfigured };
