/**
 * MEDICATION CONTROLLER — medication.controller.js
 * ==================================================
 * Handles HTTP requests for medications and tracking history.
 */

const Medication = require("./medication.model");
const MedicationHistory = require("./medicationHistory.model");
const Patient = require("../patient/patient.model");

// Helper to get patientId from userId
const getPatientId = async (userId) => {
  const patient = await Patient.findOne({ userId });
  if (!patient) {
    throw new Error("Patient profile not found. Please complete your profile first.");
  }
  return patient._id;
};

// @desc    Add a new medication
// @route   POST /api/medications
// @access  Private (Patient only)
exports.addMedication = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const patientId = await getPatientId(userId);

    const medData = { 
      ...req.body, 
      userId, 
      patientId 
    };
    
    const medication = await Medication.create(medData);

    // Notify assigned caregivers about new medication (non-blocking)
    try {
      const io = req.app.locals.io;
      const User = require("../user/user.model");
      const notificationService = require("../notification/notification.service");
      const patientUser = await User.findById(userId).select("firstName lastName");
      const patientName = `${patientUser?.firstName || ""} ${patientUser?.lastName || ""}`.trim();
      const patientDoc = await Patient.findOne({ userId });

      if (patientDoc?.assignedCaregivers) {
        for (const cgId of patientDoc.assignedCaregivers) {
          await notificationService.createNotification({
            userId: cgId,
            type: "medication_update",
            title: `💊 New Medication Added for ${patientName}`,
            message: `${patientName} added a new medication: ${medication.medicineName} (${medication.dosage || ""}). Schedule: ${(medication.schedule || []).join(", ") || "Not set"}.`,
            priority: "normal",
            channel: "both",
            fromUserId: userId,
            relatedModel: "Medication",
            relatedId: medication._id,
            io
          });

          if (io) {
            io.to(cgId.toString()).emit("medication_added", {
              patientId: userId,
              patientName,
              medicationName: medication.medicineName,
              dosage: medication.dosage,
            });
          }
        }
      }
    } catch (notifErr) {
      console.error("⚠️ Medication notification failed (med still saved):", notifErr.message);
    }
    
    res.status(201).json({
      success: true,
      message: "Medication added successfully",
      data: medication,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all medications for the user
// @route   GET /api/medications
// @access  Private
exports.getMedications = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const medications = await Medication.find({ userId }).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: medications,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a medication
// @route   PUT /api/medications/:id
// @access  Private
exports.updateMedication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    
    let medication = await Medication.findOne({ _id: id, userId });
    if (!medication) {
      return res.status(404).json({ success: false, message: "Medication not found." });
    }
    
    medication = await Medication.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    
    res.status(200).json({
      success: true,
      message: "Medication updated successfully",
      data: medication,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a medication
// @route   DELETE /api/medications/:id
// @access  Private
exports.deleteMedication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    
    const medication = await Medication.findOneAndDelete({ _id: id, userId });
    if (!medication) {
      return res.status(404).json({ success: false, message: "Medication not found." });
    }
    
    // Also delete associated history to prevent orphans
    await MedicationHistory.deleteMany({ medicationId: id });
    
    res.status(200).json({
      success: true,
      message: "Medication deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Log a medication dose (Mark as Taken/Missed)
// @route   POST /api/medications/:id/log
// @access  Private
exports.logMedication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { date, timeOfDay, status } = req.body;

    const medication = await Medication.findOne({ _id: id, userId });
    if (!medication) {
      return res.status(404).json({ success: false, message: "Medication not found." });
    }

    const patientId = medication.patientId;

    // Check if already logged for this specific date and timeOfDay
    const logDate = new Date(date);
    const startOfDay = new Date(logDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(logDate);
    endOfDay.setHours(23, 59, 59, 999);

    let history = await MedicationHistory.findOne({
      medicationId: id,
      timeOfDay,
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    if (history) {
      // Update existing log
      history.status = status;
      await history.save();
    } else {
      // Create new log
      history = await MedicationHistory.create({
        medicationId: id,
        userId,
        patientId,
        date: logDate,
        timeOfDay,
        status
      });
    }

    // ── REAL-TIME ALERT: If status is missed, notify caregivers
    if (status === "missed") {
      const io = req.app.locals.io;
      if (io) {
        const ConnectionRequest = require("../caregiver/connectionRequest.model");
        const connections = await ConnectionRequest.find({ patientId: userId, status: "accepted" }).populate("patientId", "firstName lastName");
        
        connections.forEach(conn => {
          io.to(conn.caregiverId.toString()).emit("patient_missed_medication", {
            patientId: userId,
            patientName: conn.patientId.firstName,
            medicationId: id,
            medicationName: medication.medicineName,
            timeOfDay,
            timestamp: new Date()
          });
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Medication marked as ${status}`,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get medication history (logs)
// @route   GET /api/medications/history
// @access  Private
exports.getMedicationHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate } = req.query;

    let query = { userId };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const history = await MedicationHistory.find(query)
      .populate("medicationId", "medicineName dosage")
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get medication statistics (taken vs missed percentage)
// @route   GET /api/medication/stats
// @access  Private
exports.getMedicationStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Get today's stats
    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0));
    const todayEnd = new Date(today.setHours(23, 59, 59, 999));

    const todayLogs = await MedicationHistory.find({
      userId,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    const todayTaken = todayLogs.filter((l) => l.status === "taken").length;
    const todayMissed = todayLogs.filter((l) => l.status === "missed").length;
    const todayTotal = todayTaken + todayMissed;

    // Get overall all-time stats
    const allLogs = await MedicationHistory.find({ userId });
    const totalTaken = allLogs.filter((l) => l.status === "taken").length;
    const totalMissed = allLogs.filter((l) => l.status === "missed").length;
    const totalLogged = totalTaken + totalMissed;

    res.status(200).json({
      success: true,
      data: {
        today: {
          taken: todayTaken,
          missed: todayMissed,
          total: todayTotal,
          takenPercent: todayTotal > 0 ? Math.round((todayTaken / todayTotal) * 100) : 0,
        },
        overall: {
          taken: totalTaken,
          missed: totalMissed,
          total: totalLogged,
          takenPercent: totalLogged > 0 ? Math.round((totalTaken / totalLogged) * 100) : 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
