/**
 * ADHERENCE CONTROLLER — adherence.controller.js
 * =================================================
 * HTTP handlers for medication adherence tracking,
 * reports, risk scoring, and data export.
 */

const adherenceService = require("./adherence.service");
const Patient = require("../patient/patient.model");
const Notification = require("../notification/notification.model");
const notificationService = require("../notification/notification.service");

// Helper: get patientId from userId
const getPatientId = async (userId) => {
  const patient = await Patient.findOne({ userId });
  if (!patient) throw new Error("Patient profile not found.");
  return patient._id;
};

// Helper: verify caregiver/doctor access to patient
const verifyAccess = async (requesterId, requesterRole, patientUserId) => {
  if (requesterRole === "patient") {
    if (requesterId.toString() !== patientUserId.toString()) {
      throw { status: 403, message: "You can only view your own data." };
    }
    return;
  }
  if (requesterRole === "caregiver") {
    const patient = await Patient.findOne({ userId: patientUserId, assignedCaregivers: requesterId });
    if (!patient) throw { status: 403, message: "Not authorized to view this patient." };
    return;
  }
  if (requesterRole === "doctor" || requesterRole === "admin") return;
  throw { status: 403, message: "Access denied." };
};

// POST /api/adherence/confirm — One-tap dose confirmation (by patient or caregiver)
exports.confirmDose = async (req, res, next) => {
  try {
    const requesterId = req.user._id;
    const requesterRole = req.user.role;
    const { medicationId, date, timeOfDay, status, notes } = req.body;

    if (!medicationId || !timeOfDay || !status) {
      return res.status(400).json({ success: false, message: "medicationId, timeOfDay, and status are required." });
    }

    let userId; // patient's userId
    let loggedBy = "self";
    let loggedByUserId = null;

    if (requesterRole === "caregiver") {
      userId = req.body.patientUserId;
      if (!userId) {
        return res.status(400).json({ success: false, message: "patientUserId is required when logged by caregiver." });
      }
      await verifyAccess(requesterId, requesterRole, userId);
      loggedBy = "caregiver";
      loggedByUserId = requesterId;
    } else {
      userId = requesterId;
    }

    const patientId = await getPatientId(userId);

    const log = await adherenceService.confirmDose({
      userId,
      patientId,
      medicationId,
      date: date || new Date(),
      timeOfDay,
      status,
      notes: notes || (requesterRole === "caregiver" ? "Administered by caregiver." : ""),
      loggedBy,
      loggedByUserId,
    });

    // Emit real-time updates
    const io = req.app.locals.io;
    if (io) {
      const Medication = require("../medication/medication.model");
      const med = await Medication.findById(medicationId);
      const User = require("../user/user.model");
      const patientUser = await User.findById(userId).select("firstName lastName");
      const patientName = `${patientUser?.firstName || ""} ${patientUser?.lastName || ""}`.trim();
      const now = new Date();

      // A) Emit to patient's own dashboard
      io.to(userId.toString()).emit("adherence_update", {
        log,
        medication: med ? { medicineName: med.medicineName, dosage: med.dosage } : null,
        status,
        timeOfDay,
        timestamp: now
      });

      // Notify patient via email when a caregiver logs a dose for them
      if (requesterRole === "caregiver") {
        const caregiverUser = await User.findById(requesterId).select("firstName lastName");
        const caregiverName = `${caregiverUser?.firstName || ""} ${caregiverUser?.lastName || ""}`.trim();
        await notificationService.createNotification({
          userId,
          type: "adherence_update",
          title: `💊 Your caregiver ${status === "taken" ? "confirmed" : "marked"} your dose`,
          message: `${caregiverName} marked your ${med?.medicineName || "medication"} (${timeOfDay}) as ${status}.`,
          priority: "normal",
          channel: "both",
          fromUserId: requesterId,
          relatedModel: "AdherenceLog",
          relatedId: log._id,
          io
        });
      }

      // B) Notify caregivers
      const patientDoc = await Patient.findOne({ userId }).populate("assignedCaregivers", "_id");
      
      // Send email/notification to patient themselves if missed/skipped
      if (status === "missed" || status === "skipped") {
        await notificationService.createNotification({
          userId,
          type: "missed_dose",
          title: `⚠️ You missed/skipped a dose`,
          message: `You marked your scheduled ${med?.medicineName || "medication"} (${timeOfDay}) as ${status}. Please stay on track with your health plan!`,
          priority: "high",
          channel: "both",
          fromUserId: requesterId,
          relatedModel: "AdherenceLog",
          relatedId: log._id,
          io
        });
      }

      if (patientDoc?.assignedCaregivers) {
        for (const cg of patientDoc.assignedCaregivers) {
          // Real-time event to caregiver dashboard
          io.to(cg._id.toString()).emit("patient_dose_update", {
            patientId: userId,
            patientName,
            medicationName: med?.medicineName || "Medication",
            dosage: med?.dosage || "",
            timeOfDay,
            status,
            confirmedAt: now,
            timestamp: now
          });

          // Create notification record for critical alerts (e.g. skipped or missed)
          if (status === "missed" || status === "skipped") {
            io.to(cg._id.toString()).emit("patient_missed_medication", {
              patientId: userId,
              patientName,
              medicationName: med?.medicineName || "Medication",
              timeOfDay,
              timestamp: now,
            });

            await notificationService.createNotification({
              userId: cg._id,
              type: "missed_dose",
              title: `⚠️ ${patientName} missed/skipped a dose`,
              message: `${patientName} missed/skipped ${med?.medicineName || "medication"} (${timeOfDay}). Logged by ${loggedBy}.`,
              priority: "high",
              channel: "both",
              fromUserId: userId,
              relatedModel: "AdherenceLog",
              relatedId: log._id,
              io
            });
          } else if (status === "taken") {
            // Notification record for dose taken — send email too
            await notificationService.createNotification({
              userId: cg._id,
              type: "adherence_update",
              title: `✅ ${patientName} took medication`,
              message: `${patientName} confirmed ${med?.medicineName || "medication"} (${timeOfDay}) dose. Logged by ${loggedBy}.`,
              priority: "normal",
              channel: "both",
              fromUserId: userId,
              relatedModel: "AdherenceLog",
              relatedId: log._id,
              io
            });
          }
        }
      }
    }

    res.status(201).json({ success: true, message: `Dose marked as ${status}`, data: log });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/adherence/today — Today's real-time adherence
exports.getTodayStatus = async (req, res, next) => {
  try {
    const userId = req.query.patientId || req.user._id;
    if (req.query.patientId) {
      await verifyAccess(req.user._id, req.user.role, req.query.patientId);
    }

    const status = await adherenceService.getTodayStatus(userId);
    res.status(200).json({ success: true, data: status });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/adherence/daily/:date — Daily report
exports.getDailyReport = async (req, res, next) => {
  try {
    const userId = req.query.patientId || req.user._id;
    if (req.query.patientId) {
      await verifyAccess(req.user._id, req.user.role, req.query.patientId);
    }

    const report = await adherenceService.getDailyReport(userId, req.params.date);
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/adherence/weekly — Weekly trends
exports.getWeeklyReport = async (req, res, next) => {
  try {
    const userId = req.query.patientId || req.user._id;
    if (req.query.patientId) {
      await verifyAccess(req.user._id, req.user.role, req.query.patientId);
    }

    const weeksBack = parseInt(req.query.weeksBack) || 0;
    const report = await adherenceService.getWeeklyReport(userId, weeksBack);
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/adherence/monthly — Monthly trends
exports.getMonthlyReport = async (req, res, next) => {
  try {
    const userId = req.query.patientId || req.user._id;
    if (req.query.patientId) {
      await verifyAccess(req.user._id, req.user.role, req.query.patientId);
    }

    const monthsBack = parseInt(req.query.monthsBack) || 0;
    const report = await adherenceService.getMonthlyReport(userId, monthsBack);
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/adherence/history — Searchable history
exports.getHistory = async (req, res, next) => {
  try {
    const userId = req.query.patientId || req.user._id;
    if (req.query.patientId) {
      await verifyAccess(req.user._id, req.user.role, req.query.patientId);
    }

    const result = await adherenceService.getHistory(userId, req.query);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/adherence/risk-score/:patientId — Calculate risk score
exports.getRiskScore = async (req, res, next) => {
  try {
    await verifyAccess(req.user._id, req.user.role, req.params.patientId);
    const riskScore = await adherenceService.calculateRiskScore(req.params.patientId);
    res.status(200).json({ success: true, data: riskScore });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/adherence/predictions/:patientId — Adherence prediction
exports.getPredictions = async (req, res, next) => {
  try {
    await verifyAccess(req.user._id, req.user.role, req.params.patientId);
    const predictions = await adherenceService.getAdherencePrediction(req.params.patientId);
    res.status(200).json({ success: true, data: predictions });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/adherence/patterns/:patientId — Missed-dose patterns
exports.getPatterns = async (req, res, next) => {
  try {
    await verifyAccess(req.user._id, req.user.role, req.params.patientId);
    const patterns = await adherenceService.getMissedDosePatterns(req.params.patientId);
    res.status(200).json({ success: true, data: patterns });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/adherence/export — Export adherence data
exports.exportData = async (req, res, next) => {
  try {
    const userId = req.query.patientId || req.user._id;
    if (req.query.patientId) {
      await verifyAccess(req.user._id, req.user.role, req.query.patientId);
    }

    const format = req.query.format || "json";
    const result = await adherenceService.exportData(userId, { ...req.query, format });

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=adherence_report.csv");
      return res.send(result);
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};
