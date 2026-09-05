/**
 * CAREGIVER DASHBOARD API SERVICE — caregiverDashboard.service.js
 * ==================================================================
 * Axios service calls for the Caregiver Dashboard:
 * Overview, timelines, notes, assessments, observations, mood, and emergency contacts.
 */

import api from './axios';

export const caregiverDashboardService = {
  getOverview: async () => {
    const response = await api.get('/caregiver-dashboard/overview');
    return response.data;
  },

  getAlerts: async () => {
    const response = await api.get('/caregiver-dashboard/alerts');
    return response.data;
  },

  getPatientTimeline: async (patientUserId) => {
    const response = await api.get(`/caregiver-dashboard/patients/${patientUserId}/timeline`);
    return response.data;
  },

  getPatientAdherence: async (patientUserId) => {
    const response = await api.get(`/caregiver-dashboard/patients/${patientUserId}/adherence`);
    return response.data;
  },

  // Notes
  addNote: async (data) => {
    const response = await api.post('/caregiver-dashboard/notes', data);
    return response.data;
  },

  getNotes: async (patientUserId) => {
    const response = await api.get(`/caregiver-dashboard/notes/${patientUserId}`);
    return response.data;
  },

  updateNote: async (id, data) => {
    const response = await api.put(`/caregiver-dashboard/notes/${id}`, data);
    return response.data;
  },

  deleteNote: async (id) => {
    const response = await api.delete(`/caregiver-dashboard/notes/${id}`);
    return response.data;
  },

  // Cognitive Assessments
  logCognitiveAssessment: async (data) => {
    const response = await api.post('/caregiver-dashboard/cognitive-assessment', data);
    return response.data;
  },

  getCognitiveAssessments: async (patientUserId) => {
    const response = await api.get(`/caregiver-dashboard/cognitive-assessments/${patientUserId}`);
    return response.data;
  },

  // Behavioral Observations
  logBehavioralObservation: async (data) => {
    const response = await api.post('/caregiver-dashboard/behavioral-observation', data);
    return response.data;
  },

  getBehavioralObservations: async (patientUserId) => {
    const response = await api.get(`/caregiver-dashboard/behavioral-observations/${patientUserId}`);
    return response.data;
  },

  // Mood
  logMood: async (data) => {
    const response = await api.post('/caregiver-dashboard/mood', data);
    return response.data;
  },

  getMoodHistory: async (patientUserId) => {
    const response = await api.get(`/caregiver-dashboard/mood/${patientUserId}`);
    return response.data;
  },

  // Emergency Contacts
  addEmergencyContact: async (data) => {
    const response = await api.post('/caregiver-dashboard/emergency-contacts', data);
    return response.data;
  },

  getEmergencyContacts: async (patientUserId) => {
    const response = await api.get(`/caregiver-dashboard/emergency-contacts/${patientUserId}`);
    return response.data;
  },

  updateEmergencyContact: async (id, data) => {
    const response = await api.put(`/caregiver-dashboard/emergency-contacts/${id}`, data);
    return response.data;
  },

  deleteEmergencyContact: async (id) => {
    const response = await api.delete(`/caregiver-dashboard/emergency-contacts/${id}`);
    return response.data;
  }
};
