/**
 * CRYPTO HELPERS — crypto.js
 * ===========================
 * AES-256-GCM encryption for files at rest (prescription documents) and
 * SHA-256 hashing for one-time codes. The key comes from FILE_ENCRYPTION_KEY
 * (any string — it is stretched with scrypt) and falls back to JWT_SECRET so
 * development works without extra configuration.
 */

const crypto = require("crypto");

let cachedKey = null;

const getKey = () => {
  if (cachedKey) return cachedKey;
  const secret = process.env.FILE_ENCRYPTION_KEY || process.env.JWT_SECRET || "dev-file-key";
  cachedKey = crypto.scryptSync(secret, "smht-file-salt", 32);
  return cachedKey;
};

/** Returns Buffer: [12-byte iv][16-byte auth tag][ciphertext] */
const encryptBuffer = (plain) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
};

const decryptBuffer = (payload) => {
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const data = payload.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
};

const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

/** 6-digit numeric one-time code (account recovery). */
const generateOtp = () => String(crypto.randomInt(100000, 1000000));

const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");

module.exports = { encryptBuffer, decryptBuffer, sha256, generateOtp, randomToken };
