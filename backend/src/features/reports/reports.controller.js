/**
 * REPORTS CONTROLLER — reports.controller.js
 * ============================================
 * HTTP handlers for retrieval of health reports, medication schedules,
 * risk assessments, and PDF data configurations.
 */

const reportsService = require("./reports.service");
const Patient = require("../patient/patient.model");

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

// GET /api/reports/adherence — Adherence analytics report
exports.getAdherenceReport = async (req, res, next) => {
  try {
    const patientUserId = req.query.patientId || req.user._id;
    await verifyAccess(req.user._id, req.user.role, patientUserId);

    const report = await reportsService.getAdherenceReport(patientUserId, req.query);
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/reports/medications — Medications report
exports.getMedicationsReport = async (req, res, next) => {
  try {
    const patientUserId = req.query.patientId || req.user._id;
    await verifyAccess(req.user._id, req.user.role, patientUserId);

    const report = await reportsService.getMedicationsReport(patientUserId);
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/reports/risk-analysis — Patient risk analysis report
exports.getRiskAnalysisReport = async (req, res, next) => {
  try {
    const patientUserId = req.query.patientId;
    if (!patientUserId) {
      return res.status(400).json({ success: false, message: "patientId query parameter is required." });
    }

    await verifyAccess(req.user._id, req.user.role, patientUserId);

    const report = await reportsService.getRiskAnalysisReport(patientUserId);
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/reports/export/pdf — Fetch PDF print-ready JSON config
exports.exportPdfReadyData = async (req, res, next) => {
  try {
    const patientUserId = req.query.patientId || req.user._id;
    await verifyAccess(req.user._id, req.user.role, patientUserId);

    const data = await reportsService.getPdfReadyData(patientUserId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};
