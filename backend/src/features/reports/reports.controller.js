/**
 * REPORTS CONTROLLER — reports.controller.js
 * ============================================
 * Health reports, medication schedules, risk assessments, PDF-ready data,
 * health trends, insights, performance over time and CSV exports.
 * Access is checked through utils/access.js (doctors only for their
 * assigned patients).
 */

const reportsService = require("./reports.service");
const analytics = require("./analytics.service");
const audit = require("../audit/audit.service");
const { assertPatientAccess } = require("../../utils/access");

const handle = (res, next, error) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  next(error);
};

const resolve = async (req, required = false) => {
  const patientUserId = req.user.role === "patient" ? req.user._id : req.query.patientId || (required ? null : req.user._id);
  if (!patientUserId) throw { status: 400, message: "patientId query parameter is required." };
  await assertPatientAccess(req.user, patientUserId);
  return patientUserId;
};

// GET /api/reports/adherence
exports.getAdherenceReport = async (req, res, next) => {
  try {
    const patientUserId = await resolve(req);
    res.status(200).json({ success: true, data: await reportsService.getAdherenceReport(patientUserId, req.query) });
  } catch (error) {
    handle(res, next, error);
  }
};

// GET /api/reports/medications
exports.getMedicationsReport = async (req, res, next) => {
  try {
    const patientUserId = await resolve(req);
    res.status(200).json({ success: true, data: await reportsService.getMedicationsReport(patientUserId) });
  } catch (error) {
    handle(res, next, error);
  }
};

// GET /api/reports/risk-analysis
exports.getRiskAnalysisReport = async (req, res, next) => {
  try {
    const patientUserId = await resolve(req, req.user.role !== "patient");
    res.status(200).json({ success: true, data: await reportsService.getRiskAnalysisReport(patientUserId) });
  } catch (error) {
    handle(res, next, error);
  }
};

// GET /api/reports/export/pdf
exports.exportPdfReadyData = async (req, res, next) => {
  try {
    const patientUserId = await resolve(req);
    const data = await reportsService.getPdfReadyData(patientUserId);
    await audit.record(req, { action: "report.pdf_exported", category: "data", targetUserId: patientUserId });
    res.status(200).json({ success: true, data });
  } catch (error) {
    handle(res, next, error);
  }
};

// GET /api/reports/health-trends?days=30
exports.getHealthTrends = async (req, res, next) => {
  try {
    const patientUserId = await resolve(req);
    const days = Math.min(365, Math.max(7, parseInt(req.query.days, 10) || 30));
    res.status(200).json({ success: true, data: await analytics.getHealthTrends(patientUserId, days) });
  } catch (error) {
    handle(res, next, error);
  }
};

// GET /api/reports/insights?days=30
exports.getInsights = async (req, res, next) => {
  try {
    const patientUserId = await resolve(req);
    const days = Math.min(365, Math.max(7, parseInt(req.query.days, 10) || 30));
    res.status(200).json({ success: true, data: await analytics.getInsights(patientUserId, days) });
  } catch (error) {
    handle(res, next, error);
  }
};

// GET /api/reports/performance?months=6
exports.getPerformance = async (req, res, next) => {
  try {
    const patientUserId = await resolve(req);
    const months = Math.min(24, Math.max(1, parseInt(req.query.months, 10) || 6));
    res.status(200).json({ success: true, data: await analytics.getPerformance(patientUserId, months) });
  } catch (error) {
    handle(res, next, error);
  }
};

// GET /api/reports/export/csv?type=vitals|medications|mood|full
exports.exportCsv = async (req, res, next) => {
  try {
    const patientUserId = await resolve(req);
    const { filename, csv } = await analytics.exportCsv(patientUserId, req.query.type || "full");
    await audit.record(req, { action: "report.csv_exported", category: "data", targetUserId: patientUserId, metadata: { type: req.query.type || "full" } });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.send(csv);
  } catch (error) {
    handle(res, next, error);
  }
};
