/**
 * Push notifications (expo-notifications, SDK 57).
 *
 *  - asks for permission once the user is signed in
 *  - registers the Expo push token with POST /notifications/push-token so the
 *    backend can reach the device while the app is closed (needs a
 *    development build; Expo Go on Android cannot receive remote push)
 *  - for patients, schedules LOCAL notifications for today's remaining doses
 *    from the smart-reminder schedule, so reminders fire even in Expo Go and
 *    with the app in the background
 *  - taps on a notification open the matching screen
 *
 * Web has no notification support in expo-notifications; everything is a
 * no-op there.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { qk } from '../api/queryClient';
import { notificationApi, smartReminderApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import type { Reminder } from '../types/models';

const supported = Platform.OS !== 'web';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export type PushStatus = 'unsupported' | 'undetermined' | 'denied' | 'granted';

interface PushState {
  status: PushStatus;
  token: string | null;
  lastError: string | null;
  requestPermission: () => Promise<void>;
}

const state: { status: PushStatus; token: string | null; lastError: string | null } = { status: supported ? 'undetermined' : 'unsupported', token: null, lastError: null };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const readPermission = async (): Promise<PushStatus> => {
  const p = await Notifications.getPermissionsAsync();
  return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
};

/** Registers the device for remote push when possible; never throws. */
const registerToken = async () => {
  if (!supported) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('reminders', { name: 'Medication reminders', importance: Notifications.AndroidImportance.MAX, sound: 'default', vibrationPattern: [0, 250, 250, 250] });
    }
    if (!Device.isDevice) {
      state.lastError = 'Remote push needs a physical device; local reminders still work.';
      notify();
      return;
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    state.token = token.data;
    await notificationApi.registerPushToken(token.data, Platform.OS, Device.deviceName ?? Device.modelName ?? undefined);
    state.lastError = null;
  } catch (e) {
    // Expo Go on Android (SDK 53+) or a missing EAS projectId: remote push
    // is unavailable, local reminders keep working.
    state.lastError = 'Remote push is not available in this build (Expo Go / no EAS project). Local reminders still fire on this device.';
  }
  notify();
};

const timeOfDayOf = (r: Reminder) => {
  const t = (r.title || '').toLowerCase();
  return t.includes('afternoon') ? 'Afternoon' : t.includes('evening') ? 'Evening' : t.includes('night') ? 'Night' : 'Morning';
};

/** Replace all locally scheduled reminders with today's still-pending ones. */
const scheduleLocalReminders = async (reminders: Reminder[], leadMinutes: number) => {
  if (!supported) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = Date.now();
    for (const r of reminders) {
      if (!r.scheduledTime) continue;
      const at = new Date(r.scheduledTime).getTime() - leadMinutes * 60000;
      if (at <= now) continue;
      const med = r.medicationId && typeof r.medicationId === 'object' ? r.medicationId : null;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `💊 ${timeOfDayOf(r)} medication`,
          body: med ? `Time to take ${med.medicineName} (${med.dosage}). Open the app to confirm.` : r.message,
          sound: 'default',
          data: { reminderId: r._id, type: 'reminder', screen: '/today' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at), channelId: 'reminders' },
      });
    }
  } catch (e) {
    state.lastError = `Could not schedule local reminders: ${(e as Error).message}`;
    notify();
  }
};

export function usePushNotifications(): PushState {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const requestPermission = useCallback(async () => {
    if (!supported) return;
    const p = await Notifications.requestPermissionsAsync();
    state.status = p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
    notify();
    if (p.granted) await registerToken();
  }, []);

  return { status: state.status, token: state.token, lastError: state.lastError, requestPermission };
}

/**
 * Mounted once under the providers: permission + token registration on sign-in,
 * local reminder scheduling for patients, and notification-tap navigation.
 */
export function PushNotificationsBridge() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const registered = useRef(false);
  const isPatient = user?.role === 'patient';

  const reminders = useQuery({
    queryKey: qk.smartReminders,
    queryFn: async () => {
      await smartReminderApi.generate();
      return smartReminderApi.getUpcoming();
    },
    enabled: supported && isAuthenticated && isPatient,
    refetchInterval: 15 * 60_000,
  });
  const prefs = useQuery({ queryKey: qk.reminderPreferences, queryFn: smartReminderApi.getPreferences, enabled: supported && isAuthenticated && isPatient });

  useEffect(() => {
    if (!supported) return;
    if (!isAuthenticated) {
      registered.current = false;
      Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
      return;
    }
    if (registered.current) return;
    registered.current = true;
    (async () => {
      state.status = await readPermission();
      if (state.status === 'undetermined') {
        const p = await Notifications.requestPermissionsAsync();
        state.status = p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
      }
      notify();
      if (state.status === 'granted') await registerToken();
    })();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!supported || !isPatient || !reminders.data) return;
    scheduleLocalReminders(reminders.data, prefs.data?.reminderLeadMinutes ?? 0);
  }, [reminders.data, prefs.data?.reminderLeadMinutes, isPatient]);

  useEffect(() => {
    if (!supported) return;
    const received = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['smartReminders'] });
    });
    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      const data = event.notification.request.content.data as { screen?: string; type?: string; relatedModel?: string; relatedId?: string } | undefined;
      if (!isAuthenticated) return;
      if (data?.screen) router.push(data.screen as never);
      else if (data?.type === 'prescription' && data.relatedId) router.push(`/prescription/${data.relatedId}` as never);
      else if (data?.type === 'plan_request') router.push('/plan-requests' as never);
      else if (data?.type === 'ai_alert') router.push('/ai-insights' as never);
      else router.push('/notifications' as never);
    });
    return () => {
      received.remove();
      response.remove();
    };
  }, [isAuthenticated, router, queryClient]);

  return null;
}
