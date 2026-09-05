/**
 * VITALS API SERVICE — vitals.service.js
 * ========================================
 * Handles API calls for health vitals.
 */

import api from './axios';

export const vitalsService = {
  getLatest: async () => {
    const response = await api.get('/vitals');
    return response.data;
  },

  getHistory: async () => {
    const response = await api.get('/vitals/history');
    return response.data;
  },

  // Check if patient has logged vitals today (for daily prompt)
  checkToday: async () => {
    const response = await api.get('/vitals/today-check');
    return response.data;
  },

  add: async (data) => {
    const response = await api.post('/vitals', data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/vitals/${id}`);
    return response.data;
  },
};
