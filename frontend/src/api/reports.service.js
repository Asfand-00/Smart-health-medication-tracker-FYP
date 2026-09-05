/**
 * REPORTS API SERVICE — reports.service.js
 * ===========================================
 * Axios service calls for reports and data export.
 */

import api from './axios';

export const reportsService = {
  getAdherenceReport: async (patientId, params = {}) => {
    const response = await api.get('/reports/adherence', {
      params: {
        ...(patientId ? { patientId } : {}),
        ...params
      }
    });
    return response.data;
  },

  getMedicationsReport: async (patientId) => {
    const response = await api.get('/reports/medications', {
      params: patientId ? { patientId } : {}
    });
    return response.data;
  },

  getRiskAnalysisReport: async (patientId) => {
    const response = await api.get('/reports/risk-analysis', {
      params: { patientId }
    });
    return response.data;
  },

  exportPdfReadyData: async (patientId) => {
    const response = await api.get('/reports/export/pdf', {
      params: patientId ? { patientId } : {}
    });
    return response.data;
  }
};
