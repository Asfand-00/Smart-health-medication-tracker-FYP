/**
 * AI ROUTES — ai.routes.js
 * =========================
 * GET  /api/ai/insights[?patientId=]   predictions + patterns + risks + recommendations
 * GET  /api/ai/alerts[?patientId=]     preventive alert history
 * GET  /api/ai/accuracy[?patientId=]   how often predicted misses really happened
 * POST /api/ai/run[?patientId=]        run the preventive-alert job now (admin: all patients;
 *                                      caregiver/doctor/patient: one patient)
 */

const express = require("express");
const { protect } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/roleMiddleware");
const { assertPatientAccess } = require("../../utils/access");
const aiService = require("./ai.service");

const router = express.Router();
router.use(protect);

const resolve = async (req) => {
  const patientUserId = req.user.role === "patient" ? req.user._id : req.query.patientId;
  if (!patientUserId) throw { status: 400, message: "patientId is required." };
  await assertPatientAccess(req.user, patientUserId);
  return patientUserId;
};
const handle = (res, next, error) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  next(error);
};

router.get("/insights", async (req, res, next) => {
  try {
    const patientUserId = await resolve(req);
    res.status(200).json({ success: true, data: await aiService.getInsights(patientUserId) });
  } catch (error) {
    handle(res, next, error);
  }
});

router.get("/alerts", async (req, res, next) => {
  try {
    const patientUserId = await resolve(req);
    res.status(200).json({ success: true, data: await aiService.getAlerts(patientUserId, req.query) });
  } catch (error) {
    handle(res, next, error);
  }
});

router.get("/accuracy", async (req, res, next) => {
  try {
    if (req.user.role === "admin" && !req.query.patientId) return res.status(200).json({ success: true, data: await aiService.getAccuracy(null) });
    const patientUserId = await resolve(req);
    res.status(200).json({ success: true, data: await aiService.getAccuracy(patientUserId) });
  } catch (error) {
    handle(res, next, error);
  }
});

router.post("/run", async (req, res, next) => {
  try {
    const io = req.app.locals.io;
    if (req.user.role === "admin" && !req.query.patientId) {
      await aiService.updateAlertOutcomes();
      return res.status(200).json({ success: true, message: "Preventive alert job finished.", data: await aiService.runPreventiveAlerts(io) });
    }
    const patientUserId = await resolve(req);
    await aiService.updateAlertOutcomes();
    res.status(200).json({ success: true, message: "Preventive alert check finished.", data: await aiService.runPreventiveAlertsForPatient(patientUserId, io) });
  } catch (error) {
    handle(res, next, error);
  }
});

module.exports = router;
