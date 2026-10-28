/**
 * AUDIT SERVICE — audit.service.js
 * =================================
 * `record()` is fire-and-forget: an audit failure must never break the
 * request that triggered it. `requestLogger` is an Express middleware that
 * records every state-changing request (POST/PUT/PATCH/DELETE) once the
 * response is finished, giving a complete access log without touching each
 * controller.
 */

const AuditLog = require("./auditLog.model");

const clientIp = (req) =>
  (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || req.ip || null;

const record = async (req, entry) => {
  try {
    await AuditLog.create({
      userId: entry.userId ?? req?.user?._id ?? null,
      userRole: entry.userRole ?? req?.user?.role ?? null,
      action: entry.action,
      category: entry.category || "request",
      entityType: entry.entityType || null,
      entityId: entry.entityId || null,
      targetUserId: entry.targetUserId || null,
      status: entry.status || "success",
      method: req?.method || null,
      path: req?.originalUrl || null,
      statusCode: entry.statusCode ?? null,
      ip: req ? clientIp(req) : null,
      userAgent: req?.headers?.["user-agent"] || null,
      details: entry.details || "",
      metadata: entry.metadata || {},
    });
  } catch (err) {
    console.error("⚠️ Audit log write failed:", err.message);
  }
};

const CATEGORY_BY_PREFIX = [
  ["/api/auth", "auth"],
  ["/api/user", "user"],
  ["/api/patient", "patient"],
  ["/api/medication-plans", "medication"],
  ["/api/medication-templates", "medication"],
  ["/api/medication", "medication"],
  ["/api/prescriptions", "prescription"],
  ["/api/adherence", "adherence"],
  ["/api/smart-reminders", "adherence"],
  ["/api/reminders", "notification"],
  ["/api/notifications", "notification"],
  ["/api/admin", "admin"],
  ["/api/ai", "system"],
];

const categoryFor = (path) => {
  const hit = CATEGORY_BY_PREFIX.find(([prefix]) => path.startsWith(prefix));
  return hit ? hit[1] : "request";
};

/** Records every mutating request after the response is sent. */
const requestLogger = (req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  // Login/register/password endpoints write their own richer entries.
  if (req.originalUrl.startsWith("/api/auth/")) return next();

  res.on("finish", () => {
    const ok = res.statusCode < 400;
    record(req, {
      action: `${req.method.toLowerCase()} ${req.baseUrl || ""}${req.route?.path || req.path}`.trim(),
      category: categoryFor(req.originalUrl),
      status: res.statusCode === 401 || res.statusCode === 403 ? "denied" : ok ? "success" : "failure",
      statusCode: res.statusCode,
      details: ok ? "" : `Request failed with ${res.statusCode}`,
    });
  });
  next();
};

const list = async ({ page = 1, limit = 25, userId, category, status, action, startDate, endDate, search }) => {
  const query = {};
  if (userId) query.userId = userId;
  if (category) query.category = category;
  if (status) query.status = status;
  if (action) query.action = { $regex: action, $options: "i" };
  if (search) {
    query.$or = [
      { action: { $regex: search, $options: "i" } },
      { details: { $regex: search, $options: "i" } },
      { path: { $regex: search, $options: "i" } },
    ];
  }
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const total = await AuditLog.countDocuments(query);
  const logs = await AuditLog.find(query)
    .populate("userId", "firstName lastName email role")
    .populate("targetUserId", "firstName lastName email role")
    .sort({ createdAt: -1 })
    .skip((p - 1) * l)
    .limit(l);
  return { logs, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
};

const stats = async (days = 7) => {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [byStatus, byCategory, failedLogins, total] = await Promise.all([
    AuditLog.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    AuditLog.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: "$category", count: { $sum: 1 } } }]),
    AuditLog.countDocuments({ action: "auth.login_failed", createdAt: { $gte: since } }),
    AuditLog.countDocuments({ createdAt: { $gte: since } }),
  ]);
  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id || "unknown", r.count]));
  return { days, total, byStatus: toMap(byStatus), byCategory: toMap(byCategory), failedLogins };
};

module.exports = { record, requestLogger, list, stats, clientIp };
