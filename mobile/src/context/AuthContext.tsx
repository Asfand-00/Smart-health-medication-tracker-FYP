/**
 * Auth state — port of frontend/src/context/AuthContext.jsx.
 *
 * Same flow as web:
 *  - login/register → POST /auth/login|register → { token, user }
 *  - persist token + user, restore on launch, then re-validate with GET /auth/me
 *  - logout clears local state (the backend has no logout endpoint; JWTs are stateless)
 *  - any 401 on an authenticated request → local logout
 *
 * Mobile differences: token stored in SecureStore (Keychain/Keystore), not
 * localStorage; a network failure during re-validation keeps the cached
 * session instead of logging the user out while offline.
 */
import { useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, setAuthToken, setUnauthorizedHandler } from '../api/client';
import { authApi } from '../api/services';
import type { RegisterPayload, User } from '../types/models';
import { secureStorage, STORAGE_KEYS } from '../utils/storage';
import { useToast } from './ToastContext';

interface AuthValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: (message?: string) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const toast = useToast();
  const loggingOut = useRef(false);

  const clearAuth = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    setToken(null);
    queryClient.clear();
    await Promise.all([secureStorage.remove(STORAGE_KEYS.token), secureStorage.remove(STORAGE_KEYS.user)]);
  }, [queryClient]);

  const saveAuth = useCallback(async (newToken: string, newUser: User) => {
    setAuthToken(newToken);
    setToken(newToken);
    setUser(newUser);
    await Promise.all([
      secureStorage.set(STORAGE_KEYS.token, newToken),
      secureStorage.set(STORAGE_KEYS.user, JSON.stringify(newUser)),
    ]);
  }, []);

  // Restore session on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [savedToken, savedUser] = await Promise.all([
          secureStorage.get(STORAGE_KEYS.token),
          secureStorage.get(STORAGE_KEYS.user),
        ]);
        if (!savedToken || !savedUser) return;

        setAuthToken(savedToken);
        if (!cancelled) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser) as User);
        }

        try {
          const fresh = await authApi.me();
          if (!cancelled) {
            setUser(fresh);
            await secureStorage.set(STORAGE_KEYS.user, JSON.stringify(fresh));
          }
        } catch (error) {
          // Invalid/expired token → sign out. Offline → keep the cached session.
          if (error instanceof ApiError && (error.kind === 'unauthorized' || error.kind === 'not_found')) {
            await clearAuth();
          }
        }
      } catch {
        await clearAuth();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearAuth]);

  const logout = useCallback(
    async (message = 'Logged out successfully. See you soon!') => {
      await clearAuth();
      toast.success(message);
    },
    [clearAuth, toast],
  );

  // Global 401 handling (web: axios interceptor → window.location = '/login').
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (loggingOut.current) return;
      loggingOut.current = true;
      clearAuth().finally(() => {
        loggingOut.current = false;
        toast.error('Your session has expired. Please log in again.');
      });
    });
    return () => setUnauthorizedHandler(null);
  }, [clearAuth, toast]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { token: newToken, user: newUser } = await authApi.login(email.trim(), password);
      await saveAuth(newToken, newUser);
      toast.success(`Welcome back, ${newUser.firstName}! 👋`);
      return newUser;
    },
    [saveAuth, toast],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const { token: newToken, user: newUser } = await authApi.register(payload);
      await saveAuth(newToken, newUser);
      toast.success(`Account created! Welcome, ${newUser.firstName}! 🎉`);
      return newUser;
    },
    [saveAuth, toast],
  );

  const updateUser = useCallback(async (updated: User) => {
    setUser(updated);
    await secureStorage.set(STORAGE_KEYS.user, JSON.stringify(updated));
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(user && token),
      login,
      register,
      logout,
      updateUser,
    }),
    [user, token, isLoading, login, register, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Convenience for screens that only render for a signed-in user. */
export function useCurrentUser(): User {
  const { user } = useAuth();
  // Keep the last user so a screen that is unmounting after logout can still render.
  const last = useRef<User | null>(user);
  if (user) last.current = user;
  if (!last.current) throw new Error('useCurrentUser used without a signed-in user');
  return last.current;
}
