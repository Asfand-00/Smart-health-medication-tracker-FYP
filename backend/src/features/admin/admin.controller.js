/**
 * ADMIN CONTROLLER — admin.controller.js
 * ========================================
 * Admin Panel: user & role management, system monitoring, notification and
 * alert management (broadcasts), administrative reporting and platform
 * configuration.
 */

const os = require("os");
const mongoose = require("mongoose");
const User = require("../user/user.model");
const Patient = require("../patient/patient.model");
const Medication = require("../medication/medication.model");
const AdherenceLog = require("../adherence/adherenceLog.model");
const Notification = require("../notification/notification.model");
const Prescription = require("../prescription/prescription.model");
const AuditLog = require("../audit/auditLog.model");
const RiskScore = require("../patient/riskScore.model");
const AiAlert = require("../ai/aiAlert.model");
const PushToken = require("../notification/pushToken.model");
const SystemConfig = require("./systemConfig.model");
const notificationService = require("../notification/notification.service");
const authService = require("../auth/auth.service");
const audit = require("../audit/audit.service");
const { schedulerState } = require("../smart-reminder/reminderScheduler");

const startedAt = new Date();

// ── SYSTEM MONITORING ───────────────────────────────────────────────────

// GET /api/admin/dashboard
exports.getDashboard = async (req, res, next) => {
  try {
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [byRole, totalUsers, inactiveUsers, newUsersWeek, activeToday, notifications24h, failedDeliveries24h, failedLogins24h, deniedRequests24h, prescriptionsPending, highRisk, aiAlerts24h, pushDevices, dosesToday, takenToday, missedToday, medsTotal, logsTotal] = await Promise.all([
      User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
      User.countDocuments(),
      User.countDocuments({ isActive: false }),
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      User.countDocuments({ lastLoginAt: { $gte: dayAgo } }),
      Notification.countDocuments({ createdAt: { $gte: dayAgo } }),
      Notification.countDocuments({ createdAt: { $gte: dayAgo }, "deliveries.status": "failed" }),
      AuditLog.countDocuments({ action: "auth.login_failed", createdAt: { $gte: dayAgo } }),
      AuditLog.countDocuments({ status: "denied", createdAt: { $gte: dayAgo } }),
      Prescription.countDocuments({ status: "pending", isArchived: false }),
      RiskScore.countDocuments({ overallRisk: { $in: ["high", "critical"] } }),
      AiAlert.countDocuments({ createdAt: { $gte: dayAgo } }),
      PushToken.countDocuments(),
      AdherenceLog.countDocuments({ date: { $gte: todayStart } }),
      AdherenceLog.countDocuments({ date: { $gte: todayStart }, status: { $in: ["taken", "delayed"] } }),
      AdherenceLog.countDocuments({ date: { $gte: todayStart }, status: { $in: ["missed", "skipped", "overdue"] } }),
      Medication.countDocuments(),
      AdherenceLog.countDocuments(),
    ]);

    const db = mongoose.connection;
    let dbStats = null;
    try {
      const s = await db.db.stats();
      dbStats = { collections: s.collections, objects: s.objects, dataSizeMb: Math.round((s.dataSize / 1048576) * 100) / 100, storageSizeMb: Math.round((s.storageSize / 1048576) * 100) / 100 };
    } catch {
      dbStats = null;
    }

    const io = req.app.locals.io;
    const config = await SystemConfig.getConfig();
    const mem = process.memoryUsage();

    res.status(200).json({
      success: true,
      data: {
        users: { total: totalUsers, inactive: inactiveUsers, newThisWeek: newUsersWeek, activeToday, byRole: Object.fromEntries(byRole.map((r) => [r._id, r.count])) },
        activity: { dosesToday, takenToday, missedToday, medications: medsTotal, adherenceLogs: logsTotal, prescriptionsPending, highRiskPatients: highRisk, aiAlerts24h },
        notifications: { last24h: notifications24h, failedDeliveries24h, pushDevices },
        security: { failedLogins24h, deniedRequests24h, maintenanceMode: config.maintenanceMode, allowRegistration: config.allowRegistration },
        system: {
          status: db.readyState === 1 ? "healthy" : "degraded",
          uptimeSeconds: Math.round(process.uptime()),
          startedAt,
          nodeVersion: process.version,
          platform: `${os.platform()} ${os.release()}`,
          environment: process.env.NODE_ENV || "development",
          memory: { rssMb: Math.round(mem.rss / 1048576), heapUsedMb: Math.round(mem.heapUsed / 1048576), heapTotalMb: Math.round(mem.heapTotal / 1048576) },
          cpuLoad: os.loadavg().map((n) => Math.round(n * 100) / 100),
          database: { state: ["disconnected", "connected", "connecting", "disconnecting"][db.readyState] || "unknown", host: db.host, name: db.name, ...(dbStats || {}) },
          socketConnections: io?.engine?.clientsCount ?? 0,
          scheduler: schedulerState,
          channels: { email: Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER), sms: Boolean(process.env.TWILIO_ACCOUNT_SID), push: true },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/health-checks — lightweight liveness of dependencies
exports.getHealthChecks = async (req, res, next) => {
  try {
    const started = Date.now();
    await mongoose.connection.db.admin().ping();
    const dbMs = Date.now() - started;
    res.status(200).json({ success: true, data: { database: { ok: true, latencyMs: dbMs }, scheduler: { ok: Boolean(schedulerState.lastTickAt), lastTickAt: schedulerState.lastTickAt }, uptimeSeconds: Math.round(process.uptime()) } });
  } catch (error) {
    res.status(503).json({ success: false, data: { database: { ok: false, error: error.message } } });
  }
};

// ── USER & ROLE MANAGEMENT ─────────────────────────────────────────────

// GET /api/admin/users?search=&role=&status=active|inactive&page=&limit=
exports.listUsers = async (req, res, next) => {
  try {
    const { search, role, status, page = 1, limit = 25, sort = "-createdAt" } = req.query;
    const query = {};
    if (role) query.role = role;
    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;
    if (search) query.$or = [{ firstName: { $regex: search, $options: "i" } }, { lastName: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }];
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 25));
    const [total, users] = await Promise.all([User.countDocuments(query), User.find(query).sort(sort).skip((p - 1) * l).limit(l)]);
    res.status(200).json({ success: true, data: { users: users.map((u) => u.getPublicProfile()), total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/users — create any role (incl. admin/doctor)
exports.createUser = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, role, phone, speciality } = req.body;
    if (!firstName || !lastName || !email || !password) return res.status(400).json({ success: false, message: "firstName, lastName, email and password are required." });
    if (!["patient", "caregiver", "doctor", "admin"].includes(role || "patient")) return res.status(400).json({ success: false, message: "Invalid role." });
    const config = await SystemConfig.getConfig();
    authService.validatePasswordPolicy(password, config);
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ success: false, message: "An account with this email already exists." });
    const user = await User.create({ firstName, lastName, email, password, role: role || "patient", phone: phone || null, speciality: speciality || "", isEmailVerified: true, privacyConsentAt: new Date() });
    await audit.record(req, { action: "admin.user_created", category: "admin", targetUserId: user._id, entityType: "User", entityId: user._id, details: `role ${user.role}` });
    res.status(201).json({ success: true, message: "User created.", data: { user: user.getPublicProfile() } });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/users/:id — detail with activity
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    const [activity, notifications, profile, medications, pushDevices] = await Promise.all([
      AuditLog.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20),
      Notification.countDocuments({ userId: user._id }),
      user.role === "patient" ? Patient.findOne({ userId: user._id }).select("dateOfBirth gender bloodGroup assignedCaregivers conditions") : null,
      user.role === "patient" ? Medication.countDocuments({ userId: user._id }) : 0,
      PushToken.countDocuments({ userId: user._id }),
    ]);
    res.status(200).json({ success: true, data: { user: user.getPublicProfile(), activity, notifications, profile, medications, pushDevices } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/users/:id/status  { isActive }
exports.setStatus = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) return res.status(400).json({ success: false, message: "You cannot change your own account status." });
    const isActive = Boolean(req.body.isActive);
    const user = await User.findByIdAndUpdate(req.params.id, { $set: { isActive }, ...(isActive ? {} : { $inc: { tokenVersion: 1 } }) }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    await audit.record(req, { action: isActive ? "admin.user_activated" : "admin.user_deactivated", category: "admin", targetUserId: user._id, entityType: "User", entityId: user._id });
    res.status(200).json({ success: true, message: isActive ? "Account activated." : "Account deactivated and signed out.", data: { user: user.getPublicProfile() } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/users/:id/role  { role }
exports.setRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!["patient", "caregiver", "doctor", "admin"].includes(role)) return res.status(400).json({ success: false, message: "Invalid role." });
    if (req.params.id === req.user._id.toString() && role !== "admin") return res.status(400).json({ success: false, message: "You cannot remove your own admin role." });
    const user = await User.findByIdAndUpdate(req.params.id, { $set: { role }, $inc: { tokenVersion: 1 } }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    await audit.record(req, { action: "admin.role_changed", category: "admin", targetUserId: user._id, entityType: "User", entityId: user._id, details: `→ ${role}` });
    res.status(200).json({ success: true, message: `Role changed to ${role}. The user must sign in again.`, data: { user: user.getPublicProfile() } });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/users/:id/reset-password  { newPassword? }
exports.resetUserPassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("+password");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (req.body.newPassword) {
      const config = await SystemConfig.getConfig();
      authService.validatePasswordPolicy(req.body.newPassword, config);
      user.password = req.body.newPassword;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();
      await audit.record(req, { action: "admin.password_set", category: "security", targetUserId: user._id });
      return res.status(200).json({ success: true, message: "Temporary password set. Other sessions were signed out." });
    }
    const result = await authService.requestPasswordReset(user.email);
    await audit.record(req, { action: "admin.password_reset_sent", category: "security", targetUserId: user._id });
    res.status(200).json({ success: true, message: "A reset code was emailed to the user.", data: { expiresInMinutes: result.expiresInMinutes, ...(result.devCode ? { devCode: result.devCode } : {}) } });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/users/:id/unlock
exports.unlockUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { $set: { failedLoginAttempts: 0, lockUntil: null } }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    await audit.record(req, { action: "admin.user_unlocked", category: "security", targetUserId: user._id });
    res.status(200).json({ success: true, message: "Account unlocked." });
  } catch (error) {
    next(error);
  }
};

// ── NOTIFICATION & ALERT MANAGEMENT ───────────────────────────────────

// POST /api/admin/notifications/broadcast  { title, message, roles[], priority, channel, userIds[] }
exports.broadcast = async (req, res, next) => {
  try {
    const { title, message, roles, priority = "normal", channel = "both", userIds } = req.body;
    if (!title || !message) return res.status(400).json({ success: false, message: "title and message are required." });
    const query = { isActive: true };
    if (Array.isArray(userIds) && userIds.length) query._id = { $in: userIds };
    else if (Array.isArray(roles) && roles.length) query.role = { $in: roles };
    const users = await User.find(query).select("_id");
    const broadcastId = `bc_${Date.now()}`;
    let sent = 0;
    for (const u of users) {
      await notificationService.createNotification({ userId: u._id, type: "system", title, message, priority, channel, fromUserId: req.user._id, broadcastId, io: req.app.locals.io });
      sent += 1;
    }
    await audit.record(req, { action: "admin.broadcast", category: "notification", details: `${sent} recipients`, metadata: { broadcastId, roles, priority } });
    res.status(200).json({ success: true, message: `Broadcast sent to ${sent} user(s).`, data: { broadcastId, recipients: sent } });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/notifications?type=&priority=&userId=&page=&limit=
exports.listNotifications = async (req, res, next) => {
  try {
    const { type, priority, userId, failed, page = 1, limit = 30 } = req.query;
    const query = {};
    if (type) query.type = type;
    if (priority) query.priority = priority;
    if (userId) query.userId = userId;
    if (failed === "true") query["deliveries.status"] = "failed";
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
    const [total, notifications, byType] = await Promise.all([
      Notification.countDocuments(query),
      Notification.find(query).populate("userId", "firstName lastName role").populate("fromUserId", "firstName lastName").sort({ createdAt: -1 }).skip((p - 1) * l).limit(l),
      Notification.aggregate([{ $group: { _id: "$type", count: { $sum: 1 } } }]),
    ]);
    res.status(200).json({ success: true, data: { notifications, total, page: p, limit: l, totalPages: Math.ceil(total / l), byType: Object.fromEntries(byType.map((r) => [r._id, r.count])) } });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/notifications/:id
exports.deleteNotification = async (req, res, next) => {
  try {
    const result = await Notification.deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, message: "Notification not found." });
    res.status(200).json({ success: true, message: "Notification deleted." });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/alerts — critical / escalation / AI alerts across the platform (last 7 days)
exports.listAlerts = async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const [critical, escalations, aiAlerts, highRisk] = await Promise.all([
      Notification.find({ createdAt: { $gte: since }, priority: "critical" }).populate("userId", "firstName lastName role").sort({ createdAt: -1 }).limit(50),
      Notification.countDocuments({ createdAt: { $gte: since }, type: "escalation" }),
      AiAlert.find({ createdAt: { $gte: since } }).populate("patientUserId", "firstName lastName").sort({ createdAt: -1 }).limit(50),
      RiskScore.find({ overallRisk: { $in: ["high", "critical"] } }).populate("patientUserId", "firstName lastName email").sort({ score: -1 }),
    ]);
    res.status(200).json({ success: true, data: { critical, escalationsThisWeek: escalations, aiAlerts, highRiskPatients: highRisk } });
  } catch (error) {
    next(error);
  }
};

// ── ADMINISTRATIVE REPORTING ──────────────────────────────────────────

// GET /api/admin/reports/overview
exports.reportsOverview = async (req, res, next) => {
  try {
    const months = Math.min(12, Math.max(1, parseInt(req.query.months, 10) || 6));
    const start = new Date();
    start.setMonth(start.getMonth() - (months - 1), 1);
    start.setHours(0, 0, 0, 0);

    const [growth, adherenceByMonth, notificationsByMonth, roleCounts, adherenceOverall, risk, prescriptions, topMeds] = await Promise.all([
      User.aggregate([{ $match: { createdAt: { $gte: start } } }, { $group: { _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" }, role: "$role" }, count: { $sum: 1 } } }, { $sort: { "_id.y": 1, "_id.m": 1 } }]),
      AdherenceLog.aggregate([
        { $match: { date: { $gte: start }, status: { $in: ["taken", "delayed", "missed", "skipped", "overdue"] } } },
        { $group: { _id: { y: { $year: "$date" }, m: { $month: "$date" } }, total: { $sum: 1 }, taken: { $sum: { $cond: [{ $in: ["$status", ["taken", "delayed"]] }, 1, 0] } } } },
        { $sort: { "_id.y": 1, "_id.m": 1 } },
      ]),
      Notification.aggregate([{ $match: { createdAt: { $gte: start } } }, { $group: { _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } }, count: { $sum: 1 } } }, { $sort: { "_id.y": 1, "_id.m": 1 } }]),
      User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
      AdherenceLog.aggregate([{ $match: { status: { $in: ["taken", "delayed", "missed", "skipped", "overdue"] } } }, { $group: { _id: null, total: { $sum: 1 }, taken: { $sum: { $cond: [{ $in: ["$status", ["taken", "delayed"]] }, 1, 0] } } } }]),
      RiskScore.aggregate([{ $group: { _id: "$overallRisk", count: { $sum: 1 } } }]),
      Prescription.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Medication.aggregate([{ $group: { _id: { $toLower: "$medicineName" }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    ]);

    const label = (id) => `${id.y}-${String(id.m).padStart(2, "0")}`;
    const growthByMonth = {};
    growth.forEach((g) => {
      const k = label(g._id);
      growthByMonth[k] = growthByMonth[k] || { month: k, total: 0 };
      growthByMonth[k][g._id.role] = g.count;
      growthByMonth[k].total += g.count;
    });
    const overall = adherenceOverall[0] || { total: 0, taken: 0 };

    res.status(200).json({
      success: true,
      data: {
        months,
        userGrowth: Object.values(growthByMonth),
        adherenceByMonth: adherenceByMonth.map((a) => ({ month: label(a._id), total: a.total, taken: a.taken, percent: a.total ? Math.round((a.taken / a.total) * 100) : 0 })),
        notificationsByMonth: notificationsByMonth.map((n) => ({ month: label(n._id), count: n.count })),
        usersByRole: Object.fromEntries(roleCounts.map((r) => [r._id, r.count])),
        platformAdherencePercent: overall.total ? Math.round((overall.taken / overall.total) * 100) : 0,
        totalDosesLogged: overall.total,
        riskDistribution: Object.fromEntries(risk.map((r) => [r._id, r.count])),
        prescriptionsByStatus: Object.fromEntries(prescriptions.map((p) => [p._id, p.count])),
        topMedications: topMeds.map((m) => ({ name: m._id, count: m.count })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/reports/export?type=users|adherence|audit
exports.reportsExport = async (req, res, next) => {
  try {
    const type = req.query.type || "users";
    const esc = (v) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = (headers, rows) => [headers.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
    let out;
    if (type === "users") {
      const users = await User.find().sort({ createdAt: -1 });
      out = csv(["ID", "First name", "Last name", "Email", "Role", "Active", "Last login", "Created"], users.map((u) => [u._id, u.firstName, u.lastName, u.email, u.role, u.isActive, u.lastLoginAt?.toISOString() || "", u.createdAt.toISOString()]));
    } else if (type === "adherence") {
      const logs = await AdherenceLog.find().populate("userId", "firstName lastName email").populate("medicationId", "medicineName").sort({ date: -1 }).limit(5000);
      out = csv(["Date", "Patient", "Email", "Medication", "Time", "Status", "Logged by"], logs.map((l) => [l.date.toISOString().slice(0, 10), `${l.userId?.firstName || ""} ${l.userId?.lastName || ""}`.trim(), l.userId?.email, l.medicationId?.medicineName, l.timeOfDay, l.status, l.loggedBy]));
    } else {
      const logs = await AuditLog.find().populate("userId", "email role").sort({ createdAt: -1 }).limit(5000);
      out = csv(["Time", "User", "Role", "Action", "Category", "Status", "Method", "Path", "IP", "Details"], logs.map((l) => [l.createdAt.toISOString(), l.userId?.email || "", l.userRole || "", l.action, l.category, l.status, l.method || "", l.path || "", l.ip || "", l.details]));
    }
    await audit.record(req, { action: "admin.report_exported", category: "data", metadata: { type } });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${type}-report.csv`);
    res.send(out);
  } catch (error) {
    next(error);
  }
};

// ── PLATFORM CONFIGURATION ───────────────────────────────────────────

// GET /api/admin/config
exports.getConfig = async (req, res, next) => {
  try {
    const config = await SystemConfig.getConfig(true);
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/config
exports.updateConfig = async (req, res, next) => {
  try {
    const config = await SystemConfig.getConfig(true);
    const body = req.body || {};
    const setIf = (target, source, keys) => {
      if (!source || typeof source !== "object") return;
      keys.forEach((k) => {
        if (source[k] !== undefined) target[k] = source[k];
      });
    };
    ["appName", "maintenanceMode", "maintenanceMessage", "allowRegistration", "gracePeriodMinutes"].forEach((k) => {
      if (body[k] !== undefined) config[k] = body[k];
    });
    if (Array.isArray(body.registrationRoles)) config.registrationRoles = body.registrationRoles.filter((r) => ["patient", "caregiver", "doctor"].includes(r));
    setIf(config.reminderTimes, body.reminderTimes, ["Morning", "Afternoon", "Evening", "Night"]);
    setIf(config.escalation, body.escalation, ["level2Minutes", "level3Minutes"]);
    setIf(config.ai, body.ai, ["enabled", "alertThreshold", "caregiverAlertThreshold", "lookbackDays"]);
    setIf(config.channels, body.channels, ["emailEnabled", "smsEnabled", "pushEnabled"]);
    setIf(config.security, body.security, ["maxLoginAttempts", "lockoutMinutes", "passwordMinLength", "passwordRequireNumber", "sessionDays", "otpExpiryMinutes"]);
    setIf(config.prescriptions, body.prescriptions, ["maxFileSizeMb", "requireDoctorVerification"]);
    config.updatedBy = req.user._id;
    await config.save();
    SystemConfig.invalidateCache();
    await audit.record(req, { action: "admin.config_updated", category: "admin", metadata: { keys: Object.keys(body) } });
    res.status(200).json({ success: true, message: "Configuration saved.", data: config });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/jobs/:name — run a background job on demand
exports.runJob = async (req, res, next) => {
  try {
    const io = req.app.locals.io;
    const scheduler = require("../smart-reminder/reminderScheduler");
    const aiService = require("../ai/ai.service");
    const jobs = {
      "generate-reminders": () => scheduler.checkAndGenerateDailyReminders(),
      "escalate-reminders": () => scheduler.checkAndEscalateReminders(io),
      "ai-alerts": async () => {
        await aiService.updateAlertOutcomes();
        return aiService.runPreventiveAlerts(io);
      },
      "expire-prescriptions": () => scheduler.expirePrescriptions(),
      "recalculate-risk": () => scheduler.recalculateRiskScores(),
    };
    const job = jobs[req.params.name];
    if (!job) return res.status(404).json({ success: false, message: `Unknown job. Available: ${Object.keys(jobs).join(", ")}` });
    const result = await job();
    await audit.record(req, { action: `admin.job_${req.params.name}`, category: "system" });
    res.status(200).json({ success: true, message: `Job ${req.params.name} finished.`, data: result ?? null });
  } catch (error) {
    next(error);
  }
};
