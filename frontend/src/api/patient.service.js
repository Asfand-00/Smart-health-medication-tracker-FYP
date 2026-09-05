/**
 * PATIENT API SERVICE — patient.service.js
 * ==========================================
 * Handles all API calls related to the Patient profile.
 */

import api from './axios';

export const patientService = {
  /**
   * Fetch the currently logged-in patient's profile
   */
  getProfile: async () => {
    const response = await api.get('/patient/profile');
    return response.data;
  },

  /**
   * Create or update the patient's profile
   */
  upsertProfile: async (profileData) => {
    const response = await api.put('/patient/profile', profileData);
    return response.data;
  },
};
