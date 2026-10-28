/**
 * Runtime configuration.
 *
 * The web app talks to `/api` through the Vite dev proxy and connects Socket.io
 * to `VITE_API_URL || http://localhost:5000`. A phone has no proxy and
 * `localhost` on a phone is the phone itself, so the backend origin is resolved
 * in this order:
 *
 *   1. EXPO_PUBLIC_API_URL        explicit origin, e.g. http://192.168.1.20:5000
 *   2. Expo dev-server host       the machine running `npm start` (Expo Go / dev build),
 *                                  on port EXPO_PUBLIC_API_PORT (default 5000)
 *   3. Web                         window.location.hostname:5000
 *   4. Platform default            10.0.2.2 on the Android emulator, localhost elsewhere
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = process.env.EXPO_PUBLIC_API_PORT || '5000';

function normaliseOrigin(url: string): string {
  // Accept "http://host:5000", "http://host:5000/", or "http://host:5000/api".
  return url.trim().replace(/\/+$/, '').replace(/\/api$/, '');
}

function resolveServerOrigin(): { origin: string; source: string } {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit && explicit.trim()) {
    return { origin: normaliseOrigin(explicit), source: 'EXPO_PUBLIC_API_URL' };
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return { origin: `http://${window.location.hostname}:${API_PORT}`, source: 'web host' };
  }

  // e.g. "192.168.1.20:8081" when running through Expo Go / a dev build
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return { origin: `http://${host}:${API_PORT}`, source: 'Expo dev-server host' };
  }

  if (Platform.OS === 'android') {
    return { origin: `http://10.0.2.2:${API_PORT}`, source: 'Android emulator default' };
  }
  return { origin: `http://localhost:${API_PORT}`, source: 'localhost default' };
}

const resolved = resolveServerOrigin();

/** Backend origin, used for Socket.io. */
export const SERVER_ORIGIN = resolved.origin;
/** REST base URL, equivalent to the web app's `/api`. */
export const API_BASE_URL = `${SERVER_ORIGIN}/api`;
export const SERVER_ORIGIN_SOURCE = resolved.source;

/** Request timeout; the web app uses 10s, mobile networks get a little more room. */
export const REQUEST_TIMEOUT_MS = 15000;

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log(`[config] API ${API_BASE_URL} (from ${SERVER_ORIGIN_SOURCE})`);
}
