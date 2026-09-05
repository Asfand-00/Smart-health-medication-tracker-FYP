/**
 * CAREGIVER API SERVICE — caregiver.service.js
 * ============================================
 * Handles API calls for both Patients and Caregivers.
 */

import api from './axios';

export const caregiverService = {
  // ── PATIENT ACTIONS ─────────────────────────────
  getAvailableCaregivers: async () => {
    const response = await api.get('/caregiver/available');
    return response.data;
  },

  requestCaregiver: async (caregiverId) => {
    const response = await api.post('/caregiver/request', { caregiverId });
    return response.data;
  },

  getMyTeam: async () => {
    const response = await api.get('/caregiver/my-team');
    return response.data;
  },

  getPatientRequests: async () => {
    const response = await api.get('/caregiver/patient-requests');
    return response.data;
  },

  // ── CAREGIVER ACTIONS ───────────────────────────
  getCaregiverRequests: async () => {
    const response = await api.get('/caregiver/requests');
    return response.data;
  },

  handleRequest: async (requestId, status) => {
    const response = await api.post(`/caregiver/requests/${requestId}/handle`, { status });
    return response.data;
  },

  getCaregiverPatients: async () => {
    const response = await api.get('/caregiver/patients');
    return response.data;
  },

  removePatient: async (patientId) => {
    const response = await api.delete(`/caregiver/patients/${patientId}`);
    return response.data;
  },

  getPatientRecords: async (patientId) => {
    const response = await api.get(`/caregiver/patients/${patientId}/records`);
    return response.data;
  },

  getPatientMedications: async (patientId) => {
    const response = await api.get(`/caregiver/patients/${patientId}/medications`);
    return response.data;
  },

  addPatientMedication: async (patientId, medicationData) => {
    const response = await api.post(`/caregiver/patients/${patientId}/medications`, medicationData);
    return response.data;
  },

  updatePatientMedication: async (patientId, medId, medicationData) => {
    const response = await api.put(`/caregiver/patients/${patientId}/medications/${medId}`, medicationData);
    return response.data;
  },

  deletePatientMedication: async (patientId, medId) => {
    const response = await api.delete(`/caregiver/patients/${patientId}/medications/${medId}`);
    return response.data;
  },

  logPatientDose: async (patientId, medId, doseData) => {
    const response = await api.post(`/caregiver/patients/${patientId}/medications/${medId}/log`, doseData);
    return response.data;
  }
};
