/**
 * REMINDER API SERVICE — reminder.service.js
 * ============================================
 * Handles API calls for reminder management.
 */

import api from './axios';

export const reminderService = {
  // Patient: get all their reminders
  getMyReminders: async () => {
    const response = await api.get('/reminders');
    return response.data;
  },

  // Patient: mark a reminder as read
  markAsRead: async (id) => {
    const response = await api.patch(`/reminders/${id}/read`);
    return response.data;
  },

  // Patient: alert caregiver that a dose was missed
  alertCaregiverMissed: async (data) => {
    const response = await api.post('/reminders/alert-caregiver', data);
    return response.data;
  },

  // Caregiver: create a reminder for a patient
  createReminder: async (data) => {
    const response = await api.post('/reminders', data);
    return response.data;
  },

  // Caregiver: poke a patient
  pokePatient: async (patientUserId) => {
    const response = await api.post('/reminders/poke', { patientUserId });
    return response.data;
  },
};
