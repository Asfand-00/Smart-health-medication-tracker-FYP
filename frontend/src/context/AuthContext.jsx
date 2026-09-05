/**
 * AUTH CONTEXT — AuthContext.jsx
 * ================================
 * The global state manager for authentication.
 *
 * WHAT IS REACT CONTEXT?
 * → Context is React's built-in way to share data across the entire app
 *   without passing props through every component (prop drilling).
 * → Think of it as a "global store" for auth state.
 *
 * WHAT IT STORES:
 * → user        : the logged-in user object (or null)
 * → token       : the JWT token string (or null)
 * → isLoading   : true while checking if user is already logged in
 * → isAuthenticated : boolean — is there a valid logged-in user?
 *
 * FUNCTIONS IT PROVIDES:
 * → login(email, password)  : calls API, stores token, sets user
 * → register(userData)      : calls API, stores token, sets user
 * → logout()                : clears token, resets state
 * → updateUser(userData)    : updates user in context after profile edit
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

// Step 1: Create the context object
// This is what components will "subscribe" to
const AuthContext = createContext(null);

// ── AUTH PROVIDER COMPONENT ──────────────────────────────────────────────
/**
 * AuthProvider wraps your entire app (in main.jsx).
 * Any component inside it can access auth state via useAuth() hook.
 */
export const AuthProvider = ({ children }) => {
  // ── State ──────────────────────────────────────────────────────────────
  const [user, setUser]               = useState(null);
  const [token, setToken]             = useState(null);
  const [isLoading, setIsLoading]     = useState(true); // true on first load

  // Derived state: user is authenticated if we have both token and user
  const isAuthenticated = !!user && !!token;

  // ── Initialize Auth on App Load ────────────────────────────────────────
  /**
   * On first render, check if user is already logged in
   * by reading saved token from localStorage.
   *
   * WHY localStorage?
   * → Persists across page refreshes and browser tabs.
   * → User doesn't need to log in every time they open the app.
   *
   * SECURITY NOTE: In a production app, you'd use httpOnly cookies
   * instead of localStorage to prevent XSS attacks. For a FYP,
   * localStorage is acceptable.
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const savedToken = localStorage.getItem('smht_token');
        const savedUser  = localStorage.getItem('smht_user');

        if (savedToken && savedUser) {
          // Restore state from localStorage
          setToken(savedToken);
          setUser(JSON.parse(savedUser));

          // Optional: verify token is still valid by calling /api/auth/me
          // This catches the case where token expired while user was offline
          try {
            const { data } = await api.get('/auth/me');
            setUser(data.data.user); // Refresh user data from server
          } catch {
            // Token is invalid/expired → clear everything
            clearAuth();
          }
        }
      } catch (error) {
        clearAuth();
      } finally {
        setIsLoading(false); // Done checking — hide loading screen
      }
    };

    initializeAuth();
  }, []);

  // ── Helper: Clear Auth State ───────────────────────────────────────────
  const clearAuth = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('smht_token');
    localStorage.removeItem('smht_user');
  };

  // ── Helper: Save Auth State ────────────────────────────────────────────
  const saveAuth = (tokenValue, userData) => {
    setToken(tokenValue);
    setUser(userData);
    localStorage.setItem('smht_token', tokenValue);
    localStorage.setItem('smht_user', JSON.stringify(userData));
  };

  // ── LOGIN ──────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    const { token: newToken, user: userData } = data.data;
    saveAuth(newToken, userData);
    toast.success(`Welcome back, ${userData.firstName}! 👋`);
    return userData; // Return user so the login page knows which dashboard to redirect to
  }, []);

  // ── REGISTER ───────────────────────────────────────────────────────────
  const register = useCallback(async (formData) => {
    const { data } = await api.post('/auth/register', formData);
    const { token: newToken, user: userData } = data.data;
    saveAuth(newToken, userData);
    toast.success(`Account created! Welcome, ${userData.firstName}! 🎉`);
    return userData;
  }, []);

  // ── LOGOUT ─────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    clearAuth();
    toast.success('Logged out successfully. See you soon!');
  }, []);

  // ── UPDATE USER (after profile edit) ──────────────────────────────────
  const updateUser = useCallback((updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('smht_user', JSON.stringify(updatedUser));
  }, []);

  // ── Context Value (what components can access) ─────────────────────────
  const contextValue = {
    user,
    token,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// ── CUSTOM HOOK ───────────────────────────────────────────────────────────
/**
 * useAuth — custom hook to consume AuthContext
 *
 * USAGE in any component:
 * const { user, login, logout, isAuthenticated } = useAuth();
 *
 * WHY a custom hook instead of using useContext directly?
 * → Cleaner API — one import instead of two
 * → Adds a safety check (throws error if used outside AuthProvider)
 */
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider> component');
  }

  return context;
};

export default AuthContext;
