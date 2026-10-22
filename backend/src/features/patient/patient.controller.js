/**
 * PATIENT CONTROLLER — patient.controller.js
 * ===========================================
 * Patient profile (own), read access for the care team, and health
 * condition tracking (add / update / delete with a change log).
 */

const patientService = require("./patient.service");
const Patient = require("./patient.model");
const User = require("../user/user.model");
const { assertPatientAccess } = require("../../utils/access");

const handle = (res, next, error) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  next(error);
};

/** GET /api/patient/profile */
const getProfile = async (req, res, next) => {
  try {
    const profile = await patientService.getPatientProfileByUserId(req.user._id);
    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found. Please complete your profile setup." });
    }
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

/** PUT /api/patient/profile */
const upsertProfile = async (req, res, next) => {
  try {
    const { conditions: _ignored, assignedCaregivers: _ignored2, ...profileData } = req.body;
    const updatedProfile = await patientService.upsertPatientProfile(req.user._id, profileData);
    res.status(200).json({ success: true, message: "Profile saved successfully!", data: updatedProfile });
  } catch (error) {
    next(error);
  }
};

/** GET /api/patient/:userId/profile — caregiver / doctor / admin view */
const getProfileFor = async (req, res, next) => {
  try {
    const profile = await assertPatientAccess(req.user, req.params.userId);
    const user = await User.findById(req.params.userId).select("firstName lastName email phone avatar dateOfBirth gender");
    if (!user) return res.status(404).json({ success: false, message: "Patient not found." });
    res.status(200).json({ success: true, data: { user, profile } });
  } catch (error) {
    handle(res, next, error);
  }
};

// ── HEALTH CONDITIONS ───────────────────────────────────────────────────

const resolveProfile = async (req) => {
  const patientUserId = req.user.role === "patient" ? req.user._id : req.params.userId || req.body.patientUserId || req.query.patientId;
  if (!patientUserId) throw { status: 400, message: "patientUserId is required." };
  const profile = await assertPatientAccess(req.user, patientUserId);
  if (!profile) throw { status: 404, message: "The patient has not completed their medical profile yet." };
  return profile;
};

/** GET /api/patient/conditions  |  GET /api/patient/:userId/conditions */
const listConditions = async (req, res, next) => {
  try {
    const profile = await resolveProfile(req);
    res.status(200).json({ success: true, data: profile.conditions });
  } catch (error) {
    handle(res, next, error);
  }
};

/** POST /api/patient/conditions */
const addCondition = async (req, res, next) => {
  try {
    const profile = await resolveProfile(req);
    const { name, status, severity, diagnosedOn, notes } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ success: false, message: "Condition name is required." });
    profile.conditions.push({
      name: String(name).trim(),
      status: status || "active",
      severity: severity || "mild",
      diagnosedOn: diagnosedOn ? new Date(diagnosedOn) : null,
      notes: notes || "",
      updates: [{ status: status || "active", severity: severity || "mild", note: "Condition added", byUserId: req.user._id }],
    });
    await profile.save();
    res.status(201).json({ success: true, message: "Condition added.", data: profile.conditions[profile.conditions.length - 1] });
  } catch (error) {
    handle(res, next, error);
  }
};

/** PUT /api/patient/conditions/:id */
const updateCondition = async (req, res, next) => {
  try {
    const profile = await resolveProfile(req);
    const condition = profile.conditions.id(req.params.id);
    if (!condition) return res.status(404).json({ success: false, message: "Condition not found." });
    const { name, status, severity, diagnosedOn, notes, note } = req.body;
    const changed = [];
    if (name !== undefined) condition.name = String(name).trim();
    if (status !== undefined && status !== condition.status) {
      condition.status = status;
      changed.push(`status → ${status}`);
    }
    if (severity !== undefined && severity !== condition.severity) {
      condition.severity = severity;
      changed.push(`severity → ${severity}`);
    }
    if (diagnosedOn !== undefined) condition.diagnosedOn = diagnosedOn ? new Date(diagnosedOn) : null;
    if (notes !== undefined) condition.notes = notes;
    condition.updates.push({ status: condition.status, severity: condition.severity, note: note || changed.join(", ") || "Details updated", byUserId: req.user._id });
    await profile.save();
    res.status(200).json({ success: true, message: "Condition updated.", data: condition });
  } catch (error) {
    handle(res, next, error);
  }
};

/** DELETE /api/patient/conditions/:id */
const deleteCondition = async (req, res, next) => {
  try {
    const profile = await resolveProfile(req);
    const condition = profile.conditions.id(req.params.id);
    if (!condition) return res.status(404).json({ success: false, message: "Condition not found." });
    condition.deleteOne();
    await profile.save();
    res.status(200).json({ success: true, message: "Condition removed." });
  } catch (error) {
    handle(res, next, error);
  }
};

module.exports = { getProfile, upsertProfile, getProfileFor, listConditions, addCondition, updateCondition, deleteCondition };
