/**
 * EMAIL UTILITY — email.js
 * =========================
 * Sends real email notifications using Nodemailer.
 * Automatically falls back to mocked visual logging if SMTP is not configured.
 */

const nodemailer = require("nodemailer");

// Create transporter
let transporter = null;

const initTransporter = () => {
  if (transporter) return transporter;

  const host = process.env.EMAIL_HOST;
  const port = process.env.EMAIL_PORT || 587;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port == 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    });
    console.log("📨 Real Email SMTP Transporter Configured.");
  } else {
    console.log("📝 Email SMTP credentials missing. Using Mock Email logger.");
  }
  return transporter;
};

/**
 * Send an email
 * @param {object} options - { to, subject, html, text }
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const activeTransporter = initTransporter();
    const from = process.env.EMAIL_FROM || '"Smart Mental Health Tracker" <no-reply@smht.com>';

    if (activeTransporter) {
      const info = await activeTransporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });
      console.log(`✉️ [EMAIL SENT] Message ID: ${info.messageId} to ${to}`);
      return info;
    } else {
      // Mock log
      console.log(`\n📬 [MOCK EMAIL SENT]`);
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Text: ${text}`);
      console.log(`----------------------------------------\n`);
      return { mock: true, to, subject };
    }
  } catch (error) {
    console.error("❌ Email transmission failed:", error.message);
    // Return mock fallback instead of throwing to prevent app crash
    return { error: error.message };
  }
};

module.exports = {
  sendEmail,
};
