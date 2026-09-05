/**
 * AXIOS INSTANCE — axios.js
 * ===========================
 * Creates a pre-configured Axios instance for all API calls.
 *
 * WHY a custom Axios instance?
 * → Sets the base URL once — no need to repeat it in every component
 * → Adds JWT token to EVERY request automatically via interceptors
 * → Handles 401 errors globally (auto-logout on token expiry)
 *
 * INTERCEPTORS:
 * → Request interceptor  : runs BEFORE every request is sent
 * → Response interceptor : runs AFTER every response is received
 */

import axios from 'axios';

// Create Axios instance with base configuration
const api = axios.create({
  baseURL: '/api',          // Uses Vite proxy → points to http://localhost:5000/api
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,           // Fail request if no response in 10 seconds
});

// ── REQUEST INTERCEPTOR ──────────────────────────────────────────────────
/**
 * Runs before every API request.
 * Automatically attaches the JWT token from localStorage to the
 * Authorization header so the backend's protect middleware can read it.
 */
api.interceptors.request.use(
  (config) => {
    // Get token stored after login
    const token = localStorage.getItem('smht_token');

    if (token) {
      // Attach token in the format the backend expects: "Bearer <token>"
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config; // Return modified config
  },
  (error) => Promise.reject(error)
);

// ── RESPONSE INTERCEPTOR ─────────────────────────────────────────────────
/**
 * Runs after every API response.
 * Handles 401 (Unauthorized) errors globally:
 * If the token is expired or invalid, auto-logout the user.
 */
api.interceptors.response.use(
  (response) => response, // Pass through successful responses unchanged

  (error) => {
    // If server responds with 401, the token is invalid/expired
    if (error.response?.status === 401) {
      // Clear stored auth data
      localStorage.removeItem('smht_token');
      localStorage.removeItem('smht_user');

      // Redirect to login page
      // We use window.location instead of React Router here because
      // this interceptor is outside the React component tree
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
