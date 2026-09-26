/**
 * Persistence helpers.
 *
 * - `secureStorage` holds the session (JWT + user). The web app keeps these in
 *   localStorage (`smht_token`, `smht_user`); on a phone they go to the
 *   Keychain / Android Keystore via expo-secure-store. SecureStore does not
 *   exist on web, so the web build (used only for development) falls back to
 *   AsyncStorage.
 * - `prefsStorage` holds non-sensitive preferences (accessibility settings).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const useSecureStore = Platform.OS !== 'web';

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    try {
      return useSecureStore ? await SecureStore.getItemAsync(key) : await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    if (useSecureStore) await SecureStore.setItemAsync(key, value);
    else await AsyncStorage.setItem(key, value);
  },
  async remove(key: string): Promise<void> {
    try {
      if (useSecureStore) await SecureStore.deleteItemAsync(key);
      else await AsyncStorage.removeItem(key);
    } catch {
      // nothing stored — fine
    }
  },
};

export const prefsStorage = {
  async get(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // preferences are best-effort
    }
  },
};

// Same key names as the web app so the two are easy to correlate.
export const STORAGE_KEYS = {
  token: 'smht_token',
  user: 'smht_user',
  contrast: 'accessibility-contrast',
  textSize: 'accessibility-text-size',
  audio: 'accessibility-audio',
} as const;
