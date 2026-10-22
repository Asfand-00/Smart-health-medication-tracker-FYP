/**
 * Axios instance — the mobile counterpart of frontend/src/api/axios.js.
 *
 * Differences from web:
 *  - absolute base URL (no Vite proxy on a phone)
 *  - the token is held in memory (hydrated from SecureStore by AuthContext)
 *    instead of being read from localStorage on every request
 *  - on 401 we call a handler registered by AuthContext instead of
 *    `window.location.href = '/login'`
 *  - every failure is normalised into an ApiError with a `kind`, so screens can
 *    show offline / timeout / forbidden / server states consistently
 */
import axios, { AxiosError, AxiosResponse } from 'axios';

import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../config/env';
import type { ApiEnvelope } from '../types/models';

export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'server'
  | 'unknown';

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly fieldErrors: FieldError[];

  constructor(message: string, kind: ApiErrorKind, status: number | null, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const apiError = toApiError(error);
    // Only an authenticated request that is rejected means the session is dead.
    // A 401 from /auth/login is just "wrong password".
    const sentToken = Boolean(error.config?.headers?.Authorization);
    if (apiError.kind === 'unauthorized' && sentToken && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(apiError);
  },
);

function messageFrom(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const m = (data as { message?: unknown }).message;
  if (typeof m === 'string') return m;
  // Mongoose ValidationError is returned as an array of messages
  if (Array.isArray(m)) return m.filter((x) => typeof x === 'string').join('\n');
  return null;
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (!axios.isAxiosError(error)) {
    return new ApiError(error instanceof Error ? error.message : 'Something went wrong.', 'unknown', null);
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new ApiError('The server took too long to respond. Please try again.', 'timeout', null);
  }
  if (!error.response) {
    return new ApiError(
      'Cannot reach the server. Check your internet connection and that the backend is running.',
      'network',
      null,
    );
  }

  const { status, data } = error.response;
  const serverMessage = messageFrom(data);
  const rawErrors = (data as { errors?: FieldError[] } | undefined)?.errors;
  const fieldErrors = Array.isArray(rawErrors) ? rawErrors : [];

  if (status === 401) return new ApiError(serverMessage || 'Please sign in again.', 'unauthorized', status);
  if (status === 403) return new ApiError(serverMessage || 'You do not have access to this.', 'forbidden', status);
  if (status === 404) return new ApiError(serverMessage || 'Not found.', 'not_found', status);
  if (status === 400 || status === 422) {
    return new ApiError(serverMessage || 'Please check the form and try again.', 'validation', status, fieldErrors);
  }
  if (status >= 500) {
    return new ApiError(serverMessage || 'The server had a problem. Please try again.', 'server', status);
  }
  return new ApiError(serverMessage || `Request failed (${status}).`, 'unknown', status);
}

/** Resolve `{ success, data }` envelopes to `data`. */
export async function unwrap<T>(request: Promise<AxiosResponse<ApiEnvelope<T>>>): Promise<T> {
  const response = await request;
  return response.data.data;
}

export function errorMessage(error: unknown): string {
  return toApiError(error).message;
}
