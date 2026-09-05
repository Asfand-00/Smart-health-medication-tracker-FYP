/**
 * PATIENT CONTROLLER — patient.controller.js
 * ===========================================
 * Handles HTTP requests related to the Patient profile.
 */

const patientService = require("./patient.service");

/**
 * getProfile — handles GET /api/patient/profile
 * Retrieves the profile for the currently authenticated user.
 */
const getProfile = async (req, res, next) => {
  try {
    // req.user is set by the authMiddleware
    const userId = req.user._id;

    const profile = await patientService.getPatientProfileByUserId(userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found. Please complete your profile setup.",
      });
    }

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * upsertProfile — handles PUT /api/patient/profile
 * Creates or updates the patient profile.
 */
const upsertProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const profileData = req.body;

    const updatedProfile = await patientService.upsertPatientProfile(userId, profileData);

    res.status(200).json({
      success: true,
      message: "Profile saved successfully!",
      data: updatedProfile,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  upsertProfile,
};
