/**
 * VITALS CONTROLLER — vitals.controller.js
 * =========================================
 * Handles CRUD for health vitals.
 * Added: checkTodayVitals to know if patient logged vitals today.
 */

const Vitals = require("./vitals.model");

// @desc    Check if the patient has already logged vitals today
// @route   GET /api/vitals/today-check
// @access  Private (Patient)
exports.checkTodayVitals = async (req, res, next) => {
  try {
    const patientId = req.user._id;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayVitals = await Vitals.findOne({
      patientId,
      recordedAt: { $gte: todayStart, $lte: todayEnd },
    });

    res.status(200).json({
      success: true,
      // hasLoggedToday tells the frontend whether to show the daily vitals prompt
      hasLoggedToday: !!todayVitals,
      data: todayVitals || null,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get latest vitals for the patient
// @route   GET /api/vitals
// @access  Private (Patient)
exports.getLatestVitals = async (req, res, next) => {
  try {
    const patientId = req.user._id;
    const latestVitals = await Vitals.findOne({ patientId }).sort({ recordedAt: -1 });
    
    res.status(200).json({
      success: true,
      data: latestVitals || null,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all vitals history
// @route   GET /api/vitals/history
// @access  Private (Patient)
exports.getVitalsHistory = async (req, res, next) => {
  try {
    const patientId = req.user._id;
    const history = await Vitals.find({ patientId }).sort({ recordedAt: -1 });
    
    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Record new vitals
// @route   POST /api/vitals
// @access  Private (Patient)
exports.addVitals = async (req, res, next) => {
  try {
    const patientId = req.user._id;
    const vitalsData = { ...req.body, patientId };
    
    const vitals = await Vitals.create(vitalsData);
    
    res.status(201).json({
      success: true,
      message: "Vitals recorded successfully",
      data: vitals,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a vitals record
// @route   DELETE /api/vitals/:id
// @access  Private (Patient)
exports.deleteVitals = async (req, res, next) => {
  try {
    const { id } = req.params;
    const patientId = req.user._id;
    
    const vitals = await Vitals.findOneAndDelete({ _id: id, patientId });
    if (!vitals) {
      return res.status(404).json({ success: false, message: "Record not found." });
    }
    
    res.status(200).json({
      success: true,
      message: "Vitals record deleted",
    });
  } catch (error) {
    next(error);
  }
};
