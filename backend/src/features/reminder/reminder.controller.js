/**
 * REMINDER CONTROLLER — reminder.controller.js
 * ===============================================
 * Handles:
 * - Caregiver creates reminder → patient gets real-time notification
 * - Patient views their reminders
 * - Caregiver sends "poke" to patient who missed medication
 * - Mark reminder as read
 */

const Reminder = require("./reminder.model");
const User = require("../user/user.model");
const Patient = require("../patient/patient.model");

// @desc    Caregiver creates a reminder for a patient
// @route   POST /api/reminders
// @access  Private (Caregiver)
exports.createReminder = async (req, res, next) => {
  try {
    const caregiverId = req.user._id;
    const { patientUserId, title, message, reminderType, medicationId, scheduledTime } = req.body;

    if (!patientUserId || !title) {
      return res.status(400).json({ success: false, message: "patientUserId and title are required." });
    }

    // Verify the caregiver is actually assigned to this patient
    const patientProfile = await Patient.findOne({ 
      userId: patientUserId, 
      assignedCaregivers: caregiverId 
    });
    if (!patientProfile) {
      return res.status(403).json({ success: false, message: "You are not assigned to this patient." });
    }

    // Save reminder to database
    const reminder = await Reminder.create({
      createdBy: caregiverId,
      patientUserId,
      title,
      message: message || "",
      reminderType: reminderType || "general",
      medicationId: medicationId || null,
      scheduledTime: scheduledTime || null,
    });

    // Get caregiver's name for the notification payload
    const caregiver = await User.findById(caregiverId).select("firstName lastName");

    // ── REAL-TIME NOTIFICATION via Socket.io ──────────────────────────────
    // Emit the reminder directly to the patient's personal room
    const io = req.app.locals.io;
    if (io) {
      io.to(patientUserId.toString()).emit("new_reminder", {
        _id: reminder._id,
        title: reminder.title,
        message: reminder.message,
        reminderType: reminder.reminderType,
        from: `${caregiver.firstName} ${caregiver.lastName}`,
        createdAt: reminder.createdAt,
      });
    }

    res.status(201).json({ 
      success: true, 
      message: "Reminder sent to patient.", 
      data: reminder 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Patient sends a "poke" back or caregiver pokes patient
// @route   POST /api/reminders/poke
// @access  Private (Caregiver)
exports.pokePatient = async (req, res, next) => {
  try {
    const caregiverId = req.user._id;
    const { patientUserId } = req.body;

    const patientProfile = await Patient.findOne({ 
      userId: patientUserId, 
      assignedCaregivers: caregiverId 
    });
    if (!patientProfile) {
      return res.status(403).json({ success: false, message: "You are not assigned to this patient." });
    }

    const caregiver = await User.findById(caregiverId).select("firstName lastName");

    // Save poke as a reminder
    const poke = await Reminder.create({
      createdBy: caregiverId,
      patientUserId,
      title: "👋 Your caregiver is checking on you!",
      message: `${caregiver.firstName} wants to make sure you've taken your medication. Please take it now!`,
      reminderType: "poke",
    });

    // Emit real-time poke
    const io = req.app.locals.io;
    if (io) {
      io.to(patientUserId.toString()).emit("poke", {
        from: `${caregiver.firstName} ${caregiver.lastName}`,
        message: poke.message,
        createdAt: poke.createdAt,
      });
    }

    res.status(201).json({ success: true, message: "Poke sent!", data: poke });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all reminders for the logged-in patient
// @route   GET /api/reminders
// @access  Private (Patient)
exports.getMyReminders = async (req, res, next) => {
  try {
    const patientUserId = req.user._id;

    const reminders = await Reminder.find({ patientUserId })
      .populate("createdBy", "firstName lastName role")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: reminders });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark a reminder as read
// @route   PATCH /api/reminders/:id/read
// @access  Private (Patient)
exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const patientUserId = req.user._id;

    const reminder = await Reminder.findOneAndUpdate(
      { _id: id, patientUserId },
      { isRead: true },
      { new: true }
    );

    if (!reminder) {
      return res.status(404).json({ success: false, message: "Reminder not found." });
    }

    res.status(200).json({ success: true, data: reminder });
  } catch (error) {
    next(error);
  }
};

// @desc    Alert caregiver when patient misses medication (called internally after log)
//          This is a utility function to notify caregiver via socket
// @route   POST /api/reminders/alert-caregiver
// @access  Private (Patient)
exports.alertCaregiverMissed = async (req, res, next) => {
  try {
    const patientUserId = req.user._id;
    const { medicationName, timeOfDay } = req.body;

    // Find caregivers assigned to this patient
    const patientProfile = await Patient.findOne({ userId: patientUserId })
      .populate("assignedCaregivers", "_id firstName lastName");

    if (!patientProfile || patientProfile.assignedCaregivers.length === 0) {
      return res.status(200).json({ success: true, message: "No caregivers to alert." });
    }

    const patient = await User.findById(patientUserId).select("firstName lastName");
    const io = req.app.locals.io;

    // Notify each caregiver
    patientProfile.assignedCaregivers.forEach(caregiver => {
      if (io) {
        io.to(caregiver._id.toString()).emit("patient_missed_medication", {
          patientId: patientUserId,
          patientName: `${patient.firstName} ${patient.lastName}`,
          medicationName,
          timeOfDay,
          timestamp: new Date(),
        });
      }
    });

    res.status(200).json({ success: true, message: "Caregivers alerted." });
  } catch (error) {
    next(error);
  }
};
