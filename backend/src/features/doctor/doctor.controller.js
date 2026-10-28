/**
 * DOCTOR CONTROLLER — doctor.controller.js
 * ==========================================
 * Patient side : find doctors, request one, see my doctor & requests.
 * Doctor side  : handle requests, list patients with live adherence/risk,
 *                per-patient overview, dashboard stats, clinical notes,
 *                and medication management for assigned patients.
 */

const User = require("../user/user.model");
const Patient = require("../patient/patient.model");
const Medication = require("../medication/medication.model");
const Vitals = require("../vitals/vitals.model");
const DoctorNote = require("../caregiver/doctorNote.model");
const Notification = require("../notification/notification.model");
const DoctorPatientLink = require("./doctorPatientLink.model");
const adherenceService = require("../adherence/adherence.service");
const notificationService = require("../notification/notification.service");
const { assertPatientAccess } = require("../../utils/access");

const handle = (res, next, error) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  next(error);
};

const fullName = (u) => `${u?.firstName || ""} ${u?.lastName || ""}`.trim();

// ── PATIENT SIDE ────────────────────────────────────────────────────────

// GET /api/doctor/available
exports.getAvailableDoctors = async (req, res, next) => {
  try {
    const doctors = await User.find({ role: "doctor", isActive: true }).select("firstName lastName email phone avatar speciality licenseNumber");
    res.status(200).json({ success: true, data: doctors });
  } catch (error) {
    next(error);
  }
};

// POST /api/doctor/request  { doctorId, message }
exports.requestDoctor = async (req, res, next) => {
  try {
    const patientUserId = req.user._id;
    const { doctorId, message } = req.body;
    if (!doctorId) return res.status(400).json({ success: false, message: "doctorId is required." });

    const doctor = await User.findOne({ _id: doctorId, role: "doctor", isActive: true });
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found." });

    const existing = await DoctorPatientLink.findOne({ doctorId, patientUserId, status: { $in: ["pending", "accepted"] } });
    if (existing) return res.status(400).json({ success: false, message: "Request already sent or doctor already assigned." });

    const link = await DoctorPatientLink.create({ doctorId, patientUserId, requestedBy: "patient", message: message || "" });

    await notificationService.createNotification({
      userId: doctorId,
      type: "connection_request",
      title: `🩺 New patient request from ${fullName(req.user)}`,
      message: message ? `"${message}"` : `${fullName(req.user)} would like you to supervise their medication plan.`,
      priority: "normal",
      channel: "both",
      fromUserId: patientUserId,
      io: req.app.locals.io,
    });

    res.status(201).json({ success: true, message: "Request sent to doctor.", data: link });
  } catch (error) {
    next(error);
  }
};

// GET /api/doctor/my-doctor
exports.getMyDoctors = async (req, res, next) => {
  try {
    const links = await DoctorPatientLink.find({ patientUserId: req.user._id, status: "accepted" }).populate("doctorId", "firstName lastName email phone avatar speciality");
    res.status(200).json({ success: true, data: links.map((l) => l.doctorId).filter(Boolean) });
  } catch (error) {
    next(error);
  }
};

// GET /api/doctor/my-requests
exports.getMyDoctorRequests = async (req, res, next) => {
  try {
    const links = await DoctorPatientLink.find({ patientUserId: req.user._id }).populate("doctorId", "firstName lastName email speciality").sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: links });
  } catch (error) {
    next(error);
  }
};

// ── DOCTOR SIDE ─────────────────────────────────────────────────────────

// GET /api/doctor/requests
exports.getRequests = async (req, res, next) => {
  try {
    const links = await DoctorPatientLink.find({ doctorId: req.user._id, status: "pending" }).populate("patientUserId", "firstName lastName email phone avatar dateOfBirth gender").sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: links });
  } catch (error) {
    next(error);
  }
};

// POST /api/doctor/requests/:id/handle  { status: accepted|declined }
exports.handleRequest = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["accepted", "declined"].includes(status)) return res.status(400).json({ success: false, message: "Status must be accepted or declined." });

    const link = await DoctorPatientLink.findOne({ _id: req.params.id, doctorId: req.user._id, status: "pending" });
    if (!link) return res.status(404).json({ success: false, message: "Request not found." });

    link.status = status;
    link.respondedAt = new Date();
    await link.save();

    if (status === "accepted") {
      await User.findByIdAndUpdate(link.patientUserId, { $set: { assignedDoctor: req.user._id } });
    }

    await notificationService.createNotification({
      userId: link.patientUserId,
      type: "connection_request",
      title: status === "accepted" ? `✅ Dr. ${fullName(req.user)} accepted your request` : `Dr. ${fullName(req.user)} declined your request`,
      message: status === "accepted" ? "Your doctor can now review your medications, adherence and prescriptions." : "You can send a request to another doctor.",
      priority: "normal",
      channel: "both",
      fromUserId: req.user._id,
      io: req.app.locals.io,
    });

    res.status(200).json({ success: true, message: `Request ${status}.`, data: link });
  } catch (error) {
    next(error);
  }
};

// GET /api/doctor/patients — assigned patients with adherence and risk
exports.getPatients = async (req, res, next) => {
  try {
    const links = await DoctorPatientLink.find({ doctorId: req.user._id, status: "accepted" }).populate("patientUserId", "firstName lastName email phone avatar dateOfBirth gender");
    const Prescription = require("../prescription/prescription.model");

    const patients = [];
    for (const link of links) {
      const u = link.patientUserId;
      if (!u) continue;
      const [today, weekly, risk, pendingRx, meds] = await Promise.all([
        adherenceService.getTodayStatus(u._id),
        adherenceService.getWeeklyReport(u._id),
        adherenceService.calculateRiskScore(u._id),
        Prescription.countDocuments({ patientUserId: u._id, status: "pending", isArchived: false }),
        Medication.countDocuments({ userId: u._id }),
      ]);
      patients.push({
        linkId: link._id,
        patientId: u._id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        avatar: u.avatar,
        dateOfBirth: u.dateOfBirth,
        gender: u.gender,
        linkedAt: link.respondedAt || link.updatedAt,
        todayAdherence: today.adherencePercent,
        weeklyAdherence: weekly.summary.weeklyAdherencePercent,
        riskLevel: risk.overallRisk,
        riskScore: risk.score,
        medicationCount: meds,
        pendingPrescriptions: pendingRx,
      });
    }
    res.status(200).json({ success: true, data: patients });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/doctor/patients/:id — end supervision
exports.removePatient = async (req, res, next) => {
  try {
    const link = await DoctorPatientLink.findOneAndUpdate({ doctorId: req.user._id, patientUserId: req.params.id, status: "accepted" }, { status: "ended", respondedAt: new Date() }, { new: true });
    if (!link) return res.status(404).json({ success: false, message: "Patient not found." });
    await User.updateOne({ _id: req.params.id, assignedDoctor: req.user._id }, { $set: { assignedDoctor: null } });
    res.status(200).json({ success: true, message: "Patient removed from your list." });
  } catch (error) {
    next(error);
  }
};

// GET /api/doctor/patients/:id/overview
exports.getPatientOverview = async (req, res, next) => {
  try {
    const patientUserId = req.params.id;
    const profile = await assertPatientAccess(req.user, patientUserId);
    const Prescription = require("../prescription/prescription.model");
    const MoodTracking = require("../patient/moodTracking.model");
    const CognitiveAssessment = require("../patient/cognitiveAssessment.model");

    const [user, medications, today, weekly, patterns, risk, vitals, prescriptions, moods, cognitive, notes] = await Promise.all([
      User.findById(patientUserId).select("firstName lastName email phone avatar dateOfBirth gender"),
      Medication.find({ userId: patientUserId }).sort({ createdAt: -1 }),
      adherenceService.getTodayStatus(patientUserId),
      adherenceService.getWeeklyReport(patientUserId),
      adherenceService.getMissedDosePatterns(patientUserId),
      adherenceService.calculateRiskScore(patientUserId),
      Vitals.find({ patientId: patientUserId }).sort({ recordedAt: -1 }).limit(10),
      Prescription.find({ patientUserId, isArchived: false }).sort({ createdAt: -1 }).limit(10).select("-file.storagePath"),
      MoodTracking.find({ patientUserId }).sort({ date: -1 }).limit(7),
      CognitiveAssessment.find({ patientUserId }).sort({ assessmentDate: -1 }).limit(5),
      DoctorNote.find({ patientUserId, doctorId: req.user._id }).sort({ createdAt: -1 }).limit(10),
    ]);

    res.status(200).json({ success: true, data: { user, profile, medications, today, weekly, patterns, risk, vitals, prescriptions, moods, cognitive, notes } });
  } catch (error) {
    handle(res, next, error);
  }
};

// GET /api/doctor/dashboard
exports.getDashboard = async (req, res, next) => {
  try {
    const doctorId = req.user._id;
    const Prescription = require("../prescription/prescription.model");
    const MedicationPlanRequest = require("../medication-plan/medicationPlanRequest.model");
    const RiskScore = require("../patient/riskScore.model");

    const links = await DoctorPatientLink.find({ doctorId, status: "accepted" }).select("patientUserId");
    const patientIds = links.map((l) => l.patientUserId);

    const [pendingRequests, pendingPrescriptions, pendingPlans, highRisk, unreadAlerts, recentNotes] = await Promise.all([
      DoctorPatientLink.countDocuments({ doctorId, status: "pending" }),
      Prescription.countDocuments({ patientUserId: { $in: patientIds }, status: "pending", isArchived: false }),
      MedicationPlanRequest.countDocuments({ reviewerId: doctorId, status: "pending" }),
      RiskScore.find({ patientUserId: { $in: patientIds }, overallRisk: { $in: ["high", "critical"] } }).populate("patientUserId", "firstName lastName"),
      Notification.countDocuments({ userId: doctorId, isRead: false }),
      DoctorNote.find({ doctorId }).sort({ createdAt: -1 }).limit(5).populate("patientUserId", "firstName lastName"),
    ]);

    // Average adherence across patients (this week)
    let adherenceSum = 0;
    for (const id of patientIds) {
      const weekly = await adherenceService.getWeeklyReport(id);
      adherenceSum += weekly.summary.weeklyAdherencePercent;
    }

    res.status(200).json({
      success: true,
      data: {
        totalPatients: patientIds.length,
        pendingRequests,
        pendingPrescriptions,
        pendingPlanApprovals: pendingPlans,
        averageWeeklyAdherence: patientIds.length ? Math.round(adherenceSum / patientIds.length) : 0,
        highRiskPatients: highRisk.map((r) => ({ patientId: r.patientUserId?._id, name: fullName(r.patientUserId), risk: r.overallRisk, score: r.score })),
        unreadAlerts,
        recentNotes,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── DOCTOR NOTES ────────────────────────────────────────────────────────

// POST /api/doctor/notes
exports.addNote = async (req, res, next) => {
  try {
    const { patientUserId, title, content, noteType, diagnosis, followUpDate, isConfidential } = req.body;
    if (!patientUserId || !title || !content) return res.status(400).json({ success: false, message: "patientUserId, title and content are required." });
    await assertPatientAccess(req.user, patientUserId);

    const note = await DoctorNote.create({ doctorId: req.user._id, patientUserId, title, content, noteType: noteType || "observation", diagnosis: diagnosis || "", followUpDate: followUpDate || null, isConfidential: Boolean(isConfidential) });

    if (!note.isConfidential) {
      await notificationService.createNotification({
        userId: patientUserId,
        type: "doctor_note",
        title: `🩺 Dr. ${fullName(req.user)} added a ${note.noteType.replace("_", " ")}`,
        message: `${title}${followUpDate ? ` · Follow-up: ${new Date(followUpDate).toDateString()}` : ""}`,
        priority: "normal",
        channel: "both",
        fromUserId: req.user._id,
        relatedModel: "DoctorNote",
        relatedId: note._id,
        io: req.app.locals.io,
      });
    }
    res.status(201).json({ success: true, message: "Note saved.", data: note });
  } catch (error) {
    handle(res, next, error);
  }
};

// GET /api/doctor/notes/:patientId  (doctor: own notes; patient: non-confidential notes about them)
exports.getNotes = async (req, res, next) => {
  try {
    const patientUserId = req.params.patientId;
    await assertPatientAccess(req.user, patientUserId);
    const query = { patientUserId };
    if (req.user.role === "doctor") query.doctorId = req.user._id;
    else query.isConfidential = false;
    const notes = await DoctorNote.find(query).populate("doctorId", "firstName lastName speciality").sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: notes });
  } catch (error) {
    handle(res, next, error);
  }
};

// PUT /api/doctor/notes/:id
exports.updateNote = async (req, res, next) => {
  try {
    const note = await DoctorNote.findOne({ _id: req.params.id, doctorId: req.user._id });
    if (!note) return res.status(404).json({ success: false, message: "Note not found." });
    ["title", "content", "noteType", "diagnosis", "followUpDate", "isConfidential"].forEach((f) => {
      if (req.body[f] !== undefined) note[f] = req.body[f];
    });
    await note.save();
    res.status(200).json({ success: true, message: "Note updated.", data: note });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/doctor/notes/:id
exports.deleteNote = async (req, res, next) => {
  try {
    const result = await DoctorNote.deleteOne({ _id: req.params.id, doctorId: req.user._id });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, message: "Note not found." });
    res.status(200).json({ success: true, message: "Note deleted." });
  } catch (error) {
    next(error);
  }
};

// ── DOCTOR MEDICATION MANAGEMENT ────────────────────────────────────────

// GET /api/doctor/patients/:id/medications
exports.getPatientMedications = async (req, res, next) => {
  try {
    await assertPatientAccess(req.user, req.params.id);
    const medications = await Medication.find({ userId: req.params.id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: medications });
  } catch (error) {
    handle(res, next, error);
  }
};

// POST /api/doctor/patients/:id/medications
exports.addPatientMedication = async (req, res, next) => {
  try {
    const patientUserId = req.params.id;
    const profile = await assertPatientAccess(req.user, patientUserId);
    if (!profile) return res.status(400).json({ success: false, message: "The patient has not completed their medical profile yet." });

    const medication = await Medication.create({ ...req.body, userId: patientUserId, patientId: profile._id, addedBy: req.user._id, addedByRole: "doctor" });
    await notificationService.createNotification({
      userId: patientUserId,
      type: "medication_update",
      title: `💊 Dr. ${fullName(req.user)} prescribed ${medication.medicineName}`,
      message: `${medication.medicineName} (${medication.dosage}) — ${medication.frequency}, ${medication.timeOfDay.join(", ")}.`,
      priority: "normal",
      channel: "both",
      fromUserId: req.user._id,
      relatedModel: "Medication",
      relatedId: medication._id,
      io: req.app.locals.io,
    });
    if (req.app.locals.io) req.app.locals.io.to(patientUserId.toString()).emit("medication_updated");
    res.status(201).json({ success: true, message: "Medication added for patient.", data: medication });
  } catch (error) {
    handle(res, next, error);
  }
};

// PUT /api/doctor/patients/:id/medications/:medId
exports.updatePatientMedication = async (req, res, next) => {
  try {
    await assertPatientAccess(req.user, req.params.id);
    const medication = await Medication.findOneAndUpdate({ _id: req.params.medId, userId: req.params.id }, req.body, { new: true, runValidators: true });
    if (!medication) return res.status(404).json({ success: false, message: "Medication not found." });
    if (req.app.locals.io) req.app.locals.io.to(req.params.id.toString()).emit("medication_updated");
    res.status(200).json({ success: true, message: "Medication updated.", data: medication });
  } catch (error) {
    handle(res, next, error);
  }
};

// DELETE /api/doctor/patients/:id/medications/:medId
exports.deletePatientMedication = async (req, res, next) => {
  try {
    await assertPatientAccess(req.user, req.params.id);
    const medication = await Medication.findOneAndDelete({ _id: req.params.medId, userId: req.params.id });
    if (!medication) return res.status(404).json({ success: false, message: "Medication not found." });
    if (req.app.locals.io) req.app.locals.io.to(req.params.id.toString()).emit("medication_updated");
    res.status(200).json({ success: true, message: "Medication deleted." });
  } catch (error) {
    handle(res, next, error);
  }
};
