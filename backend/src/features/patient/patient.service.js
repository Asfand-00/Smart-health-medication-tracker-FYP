/**
 * PATIENT SERVICE — patient.service.js
 * =====================================
 * Handles business logic and database operations for patient profiles.
 */

const Patient = require("./patient.model");

/**
 * getPatientProfileByUserId
 * Retrieves the profile for a given user ID.
 * Optionally populates caregivers or user info if needed.
 */
const getPatientProfileByUserId = async (userId) => {
  const profile = await Patient.findOne({ userId });
  return profile; // Returns null if not found
};

/**
 * upsertPatientProfile
 * Creates a new profile if one doesn't exist, or updates the existing one.
 */
const upsertPatientProfile = async (userId, profileData) => {
  // We use findOneAndUpdate with { upsert: true, new: true }
  // This is a powerful Mongoose feature that creates the document if missing,
  // or updates it if found, returning the updated document.
  
  const updatedProfile = await Patient.findOneAndUpdate(
    { userId },                 // Query to find the document
    { ...profileData, userId }, // Data to update/insert (ensure userId is always set)
    { 
      new: true,               // Return the new document, not the old one
      upsert: true,            // Create if it doesn't exist
      runValidators: true      // Run schema validations on update
    }
  );

  return updatedProfile;
};

module.exports = {
  getPatientProfileByUserId,
  upsertPatientProfile,
};
