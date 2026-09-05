/**
 * ADHERENCE API SERVICE — adherence.service.js
 * ===============================================
 * Axios service calls for medication adherence tracking.
 */

import api from './axios';

export const adherenceService = {
  confirmDose: async (data) => {
    const response = await api.post('/adherence/confirm', data);
    return response.data;
  },

  getTodayStatus: async (patientId) => {
    const response = await api.get('/adherence/today', {
      params: patientId ? { patientId } : {}
    });
    return response.data;
  },

  getDailyReport: async (date, patientId) => {
    const response = await api.get(`/adherence/daily/${date}`, {
      params: patientId ? { patientId } : {}
    });
    return response.data;
  },

  getWeeklyReport: async (patientId, weeksBack = 0) => {
    const response = await api.get('/adherence/weekly', {
      params: {
        weeksBack,
        ...(patientId ? { patientId } : {})
      }
    });
    return response.data;
  },

  getMonthlyReport: async (patientId, monthsBack = 0) => {
    const response = await api.get('/adherence/monthly', {
      params: {
        monthsBack,
        ...(patientId ? { patientId } : {})
      }
    });
    return response.data;
  },

  getHistory: async (params = {}) => {
    const response = await api.get('/adherence/history', { params });
    return response.data;
  },

  getRiskScore: async (patientId) => {
    const response = await api.get(`/adherence/risk-score/${patientId}`);
    return response.data;
  },

  getPredictions: async (patientId) => {
    const response = await api.get(`/adherence/predictions/${patientId}`);
    return response.data;
  },

  getPatterns: async (patientId) => {
    const response = await api.get(`/adherence/patterns/${patientId}`);
    return response.data;
  },

  exportData: async (params = {}) => {
    const response = await api.get('/adherence/export', { params });
    return response.data;
  }
};
