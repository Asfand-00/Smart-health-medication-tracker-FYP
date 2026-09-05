/**
 * ADMIN API SERVICE — admin.service.js
 * ============================================
 * Handles API calls for Admin operations.
 */

import api from './axios';

export const adminService = {
  getAllUsers: async () => {
    const response = await api.get('/user/all');
    return response.data;
  },

  updateUser: async (userId, userData) => {
    const response = await api.put(`/user/${userId}`, userData);
    return response.data;
  },

  deleteUser: async (userId) => {
    const response = await api.delete(`/user/${userId}`);
    return response.data;
  }
};
