/**
 * MEDICATION API SERVICE — medication.service.js
 * ================================================
 * Handles API calls for the medication management feature.
 */

import api from './axios';

export const medicationService = {
  getAll: async () => {
    const response = await api.get('/medication');
    return response.data;
  },

  add: async (data) => {
    const response = await api.post('/medication', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/medication/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/medication/${id}`);
    return response.data;
  },

  logDose: async (id, data) => {
    // data: { date, timeOfDay, status }
    const response = await api.post(`/medication/${id}/log`, data);
    return response.data;
  },

  getHistory: async (params) => {
    const response = await api.get('/medication/history', { params });
    return response.data;
  },

  // Get taken vs missed statistics
  getStats: async () => {
    const response = await api.get('/medication/stats');
    return response.data;
  }
};
