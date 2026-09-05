/**
 * CAREGIVER CONTROLLER — caregiver.controller.js
 * ===============================================
 * Handles requests between Patients and Caregivers.
 */

const User = require("../user/user.model");
const Patient = require("../patient/patient.model");
const ConnectionRequest = require("./connectionRequest.model");
const Medication = require("../medication/medication.model");
const Vitals = require("../vitals/vitals.model");

// ── PATIENT ACTIONS ───────────────────────────────────────────────

// GET /api/caregiver/available
// List all users with 'caregiver' role
exports.getAvailableCaregivers = async (req, res, next) => {
  try {
    const caregivers = await User.find({ role: "caregiver", isActive: true })
      .select("firstName lastName email phone avatar");

    res.status(200).json({ success: true, data: caregivers });
  } catch (error) {
    next(error);
  }
};

// POST /api/caregiver/request
// Patient sends request to caregiver
exports.requestCaregiver = async (req, res, next) => {
  try {
    const patientId = req.user._id;
    const { caregiverId } = req.body;

    if (!caregiverId) {
      return res.status(400).json({ success: false, message: "Caregiver ID is required." });
    }

    // Check if caregiver exists
    const caregiver = await User.findOne({ _id: caregiverId, role: "caregiver" });
    if (!caregiver) {
      return res.status(404).json({ success: false, message: "Caregiver not found." });
    }

    // Check if already requested or connected
    const existingRequest = await ConnectionRequest.findOne({ patientId, caregiverId, status: { $in: ["pending", "accepted"] } });
    if (existingRequest) {
      return res.status(400).json({ success: false, message: "Request already sent or caregiver already assigned." });
    }

    const request = await ConnectionRequest.create({ patientId, caregiverId, status: "pending" });

    res.status(201).json({ success: true, message: "Request sent to caregiver.", data: request });
  } catch (error) {
    next(error);
  }
};

// GET /api/caregiver/my-team
// Get approved caregivers for the patient
exports.getMyCareTeam = async (req, res, next) => {
  try {
    const profile = await Patient.findOne({ userId: req.user._id }).populate("assignedCaregivers", "firstName lastName email phone avatar");
    res.status(200).json({ success: true, data: profile?.assignedCaregivers || [] });
  } catch (error) {
    next(error);
  }
};

// GET /api/caregiver/patient-requests
// Get patient's sent requests
exports.getPatientRequests = async (req, res, next) => {
  try {
    const requests = await ConnectionRequest.find({ patientId: req.user._id })
      .populate("caregiverId", "firstName lastName email");
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
};


// ── CAREGIVER ACTIONS ─────────────────────────────────────────────

// GET /api/caregiver/requests
// Caregiver views incoming requests
exports.getCaregiverRequests = async (req, res, next) => {
  try {
    const requests = await ConnectionRequest.find({ caregiverId: req.user._id, status: "pending" })
      .populate("patientId", "firstName lastName email phone avatar");
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
};

// POST /api/caregiver/requests/:id/handle
// Caregiver accepts or declines request
exports.handleRequest = async (req, res, next) => {
  try {
    const { status } = req.body; // 'accepted' or 'declined'
    const requestId = req.params.id;

    if (!["accepted", "declined"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be accepted or declined." });
    }

    const request = await ConnectionRequest.findOne({ _id: requestId, caregiverId: req.user._id });
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found." });
    }

    request.status = status;
    await request.save();

    if (status === "accepted") {
      // Add caregiver to patient's assignedCaregivers list
      await Patient.findOneAndUpdate(
        { userId: request.patientId },
        { $addToSet: { assignedCaregivers: req.user._id } },
        { new: true, upsert: true }
      );
    }

    res.status(200).json({ success: true, message: `Request ${status}.`, data: request });
  } catch (error) {
    next(error);
  }
};

// GET /api/caregiver/patients
// Get patients assigned to the caregiver
exports.getCaregiverPatients = async (req, res, next) => {
  try {
    const patients = await Patient.find({ assignedCaregivers: req.user._id })
      .populate("userId", "firstName lastName email phone avatar dateOfBirth gender");
    res.status(200).json({ success: true, data: patients });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/caregiver/patients/:id
// Caregiver removes a patient from their care list
exports.removePatient = async (req, res, next) => {
  try {
    const patientUserId = req.params.id;
    const caregiverId = req.user._id;

    // Remove caregiver from patient's assignedCaregivers array
    const patient = await Patient.findOneAndUpdate(
      { userId: patientUserId },
      { $pull: { assignedCaregivers: caregiverId } },
      { new: true }
    );

    if (!patient) return res.status(404).json({ success: false, message: "Patient not found." });

    // Also update connection request status to deleted/declined
    const ConnectionRequest = require("./connectionRequest.model");
    await ConnectionRequest.findOneAndUpdate(
      { patientId: patientUserId, caregiverId, status: "accepted" },
      { status: "declined" }
    );

    res.status(200).json({ success: true, message: "Patient removed successfully." });
  } catch (error) {
    next(error);
  }
};

// GET /api/caregiver/patients/:id/records
// Caregiver views a specific patient's vitals & medications
exports.getPatientRecords = async (req, res, next) => {
  try {
    const patientUserId = req.params.id;
    
    // Verify assignment
    const patientProfile = await Patient.findOne({ userId: patientUserId, assignedCaregivers: req.user._id });
    if (!patientProfile) {
      return res.status(403).json({ success: false, message: "Not authorized to view this patient's records." });
    }

    const vitals = await Vitals.find({ patientId: patientUserId }).sort({ recordedAt: -1 });
    const medications = await Medication.find({ patientId: patientUserId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        profile: patientProfile,
        vitals,
        medications
      }
    });
  } catch (error) {
    next(error);
  }
};

// ── CAREGIVER MEDICATION MANAGEMENT ──────────────────────────────────────

// Helper: verify caregiver is assigned to this patient
const verifyCaregiverAssignment = async (caregiverId, patientUserId) => {
  const patientProfile = await Patient.findOne({ userId: patientUserId, assignedCaregivers: caregiverId });
  if (!patientProfile) throw { status: 403, message: "Not authorized to manage this patient's medications." };
  return patientProfile;
};

// GET /api/caregiver/patients/:id/medications
// Caregiver views all medications for a patient
exports.getPatientMedications = async (req, res, next) => {
  try {
    const patientUserId = req.params.id;
    await verifyCaregiverAssignment(req.user._id, patientUserId);

    const medications = await Medication.find({ userId: patientUserId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: medications });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// POST /api/caregiver/patients/:id/medications
// Caregiver adds medication for patient + notifies patient via Socket.io
exports.addPatientMedication = async (req, res, next) => {
  try {
    const patientUserId = req.params.id;
    const patientProfile = await verifyCaregiverAssignment(req.user._id, patientUserId);

    const medData = {
      ...req.body,
      userId: patientUserId,         // medication belongs to patient's userId
      patientId: patientProfile._id, // linked to Patient document
      addedByCaregiver: req.user._id,
    };

    const medication = await Medication.create(medData);
    const User = require("../user/user.model");
    const caregiver = await User.findById(req.user._id).select("firstName lastName");

    // Real-time: notify the patient about their new medication
    const io = req.app.locals.io;
    if (io) {
      io.to(patientUserId.toString()).emit("new_reminder", {
        title: `💊 New Medication Added: ${medication.medicineName}`,
        message: `${caregiver.firstName} added ${medication.medicineName} (${medication.dosage}) to your schedule. Take it ${medication.frequency} — ${medication.timeOfDay?.join(', ')}.`,
        reminderType: "medication",
        from: `${caregiver.firstName} ${caregiver.lastName}`,
        createdAt: new Date(),
      });
      // Also tell their dashboard to refresh
      io.to(patientUserId.toString()).emit("medication_updated");
    }

    // Database notification + Email notification to patient (non-blocking)
    try {
      const notificationService = require("../notification/notification.service");
      const caregiverName = `${caregiver?.firstName || ""} ${caregiver?.lastName || ""}`.trim();
      await notificationService.createNotification({
        userId: patientUserId,
        type: "medication_update",
        title: `💊 New Medication Assigned: ${medication.medicineName}`,
        message: `Your caregiver ${caregiverName} has assigned a new medication to your schedule: ${medication.medicineName} (${medication.dosage}). Frequency: ${medication.frequency}. Time: ${medication.timeOfDay?.join(', ')}.`,
        priority: "normal",
        channel: "both",
        fromUserId: req.user._id,
        relatedModel: "Medication",
        relatedId: medication._id,
        io
      });
    } catch (notifErr) {
      console.error("⚠️ Patient medication assignment notification failed:", notifErr.message);
    }

    res.status(201).json({ success: true, message: "Medication added for patient.", data: medication });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// PUT /api/caregiver/patients/:id/medications/:medId
// Caregiver edits a patient's medication
exports.updatePatientMedication = async (req, res, next) => {
  try {
    const { id: patientUserId, medId } = req.params;
    await verifyCaregiverAssignment(req.user._id, patientUserId);

    const medication = await Medication.findOneAndUpdate(
      { _id: medId, userId: patientUserId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!medication) return res.status(404).json({ success: false, message: "Medication not found." });

    // Notify patient of update
    const io = req.app.locals.io;
    if (io) {
      io.to(patientUserId.toString()).emit("new_reminder", {
        title: `✏️ Medication Updated: ${medication.medicineName}`,
        message: `Your caregiver updated ${medication.medicineName}. New dosage: ${medication.dosage}.`,
        reminderType: "medication",
        from: "Your Caregiver",
        createdAt: new Date(),
      });
      io.to(patientUserId.toString()).emit("medication_updated");
    }

    res.status(200).json({ success: true, message: "Medication updated.", data: medication });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// DELETE /api/caregiver/patients/:id/medications/:medId
// Caregiver deletes a patient's medication
exports.deletePatientMedication = async (req, res, next) => {
  try {
    const { id: patientUserId, medId } = req.params;
    await verifyCaregiverAssignment(req.user._id, patientUserId);

    const medication = await Medication.findOneAndDelete({ _id: medId, userId: patientUserId });
    if (!medication) return res.status(404).json({ success: false, message: "Medication not found." });

    const io = req.app.locals.io;
    if (io) {
      io.to(patientUserId.toString()).emit("medication_updated");
    }

    res.status(200).json({ success: true, message: "Medication deleted." });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// POST /api/caregiver/patients/:id/medications/:medId/log
// Caregiver logs a dose on behalf of the patient
exports.logPatientMedication = async (req, res, next) => {
  try {
    const { id: patientUserId, medId } = req.params;
    const { date, timeOfDay, status } = req.body;
    const patientProfile = await verifyCaregiverAssignment(req.user._id, patientUserId);

    const Medication = require("../medication/medication.model");
    const medication = await Medication.findOne({ _id: medId, userId: patientUserId });
    
    if (!medication) return res.status(404).json({ success: false, message: "Medication not found." });

    const adherenceService = require("../adherence/adherence.service");
    const history = await adherenceService.confirmDose({
      userId: patientUserId,
      patientId: patientProfile._id,
      medicationId: medId,
      date: date || new Date(),
      timeOfDay,
      status: status || "taken",
      notes: "Logged by caregiver",
      loggedBy: "caregiver",
      loggedByUserId: req.user._id
    });

    const io = req.app.locals.io;
    if (io) {
      io.to(patientUserId.toString()).emit("medication_logged", {
        medicationId: medId,
        timeOfDay,
        status: status || "taken",
        loggedBy: "Caregiver"
      });
      io.to(patientUserId.toString()).emit("medication_updated");
      io.to(req.user._id.toString()).emit("medication_logged", {
        medicationId: medId,
        timeOfDay,
        status: status || "taken",
        loggedBy: "Caregiver"
      });
    }

    res.status(200).json({ success: true, message: "Dose logged successfully.", data: history });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};
