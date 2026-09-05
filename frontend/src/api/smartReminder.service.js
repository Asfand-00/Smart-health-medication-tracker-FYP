/**
 * SMART REMINDER API SERVICE — smartReminder.service.js
 * =======================================================
 * Axios service calls for generating and acknowledging medication reminders.
 */

import api from './axios';

export const smartReminderService = {
  generateReminders: async () => {
    const response = await api.post('/smart-reminders/generate');
    return response.data;
  },

  getUpcomingReminders: async () => {
    const response = await api.get('/smart-reminders/upcoming');
    return response.data;
  },

  acknowledgeReminder: async (id, data) => {
    const response = await api.post(`/smart-reminders/acknowledge/${id}`, data);
    return response.data;
  },

  getReminderHistory: async () => {
    const response = await api.get('/smart-reminders/history');
    return response.data;
  },

  getSuggestions: async () => {
    const response = await api.get('/smart-reminders/suggestions');
    return response.data;
  },

  escalateReminder: async (id) => {
    const response = await api.post(`/smart-reminders/escalate/${id}`);
    return response.data;
  },

  getMissedReminders: async () => {
    const response = await api.get('/smart-reminders/missed');
    return response.data;
  }
};
