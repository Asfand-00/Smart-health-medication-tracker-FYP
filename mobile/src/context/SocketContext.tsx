/**
 * Real-time events — port of frontend/src/context/SocketContext.jsx and the
 * socket half of NotificationContext.jsx.
 *
 * Same protocol as web: connect to the backend origin over websocket, emit
 * `join` with the user id (the server puts each user in a room named by id),
 * then listen for role-specific events.
 *
 * Mobile additions:
 *  - events invalidate TanStack Query caches instead of each page wiring its
 *    own socket listener, so every open screen refreshes itself
 *  - the connection is re-joined after reconnects and when the app returns to
 *    the foreground (mobile OSes suspend sockets in the background)
 *  - text-to-speech via expo-speech
 */
import { useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { io, Socket } from 'socket.io-client';

import { qk } from '../api/queryClient';
import { SERVER_ORIGIN } from '../config/env';
import { useAccessibility } from './AccessibilityContext';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

export interface MissedMedicationAlert {
  id: number;
  patientId: string;
  patientName: string;
  medicationName: string;
  timeOfDay: string;
  timestamp: string;
}

interface SocketValue {
  connected: boolean;
  /** In-session list shown on the caregiver home screen (web keeps the same in component state). */
  missedAlerts: MissedMedicationAlert[];
  dismissMissedAlert: (id: number) => void;
}

const SocketContext = createContext<SocketValue>({ connected: false, missedAlerts: [], dismissMissedAlert: () => {} });

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { speakAlways } = useAccessibility();
  const [connected, setConnected] = useState(false);
  const [missedAlerts, setMissedAlerts] = useState<MissedMedicationAlert[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // Handlers read the latest toast/speech functions without re-connecting.
  const handlersRef = useRef({ toast, speakAlways });
  handlersRef.current = { toast, speakAlways };

  const userId = user?._id || user?.id;
  const role = user?.role;

  useEffect(() => {
    if (!isAuthenticated || !userId || !role) {
      setMissedAlerts([]);
      return;
    }

    const socket = io(SERVER_ORIGIN, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 15000,
    });
    socketRef.current = socket;

    const invalidate = (...keys: readonly (readonly unknown[])[]) => {
      keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    };

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join', userId);
    });
    socket.on('disconnect', () => setConnected(false));

    // Every role: unified notifications (NotificationContext.jsx)
    socket.on('new_notification', (n: { title?: string; message?: string; type?: string }) => {
      invalidate(['notifications'], qk.caregiverAlerts, qk.caregiverOverview);
      if (role === 'patient') {
        let text = n.title ?? '';
        if (n.type === 'missed_dose' || n.type === 'escalation') {
          text = `Attention. ${n.title}. ${n.message ?? ''}`;
        }
        handlersRef.current.speakAlways(text);
      }
    });

    if (role === 'patient') {
      const refreshPatientData = () =>
        invalidate(qk.medications, qk.smartReminders, ['adherence'], qk.reminders, ['vitals']);

      socket.on('new_reminder', (r: { title: string; message?: string; speechText?: string }) => {
        handlersRef.current.toast.info(`🔔 New Reminder: ${r.title}`, 6000);
        handlersRef.current.speakAlways(r.speechText || `Attention. New reminder: ${r.title}. ${r.message || ''}`);
        invalidate(qk.reminders, qk.smartReminders);
      });

      socket.on('poke', (d: { from: string; message?: string }) => {
        handlersRef.current.toast.warning(`👋 ${d.from} is checking on you!\n${d.message ?? ''}`, 8000);
        handlersRef.current.speakAlways(`Attention. ${d.from} is checking on you. Message: ${d.message || ''}`);
        invalidate(qk.reminders);
      });

      socket.on('medication_logged', refreshPatientData);
      socket.on('medication_updated', refreshPatientData);
      socket.on('adherence_update', refreshPatientData);
      socket.on('mood_update', () => invalidate(['mood']));
    }

    if (role === 'caregiver') {
      const refreshCaregiverData = () =>
        invalidate(qk.caregiverOverview, qk.caregiverAlerts, ['caregiver', 'adherence'], ['caregiver', 'timeline']);

      socket.on(
        'patient_missed_medication',
        (d: { patientId: string; patientName: string; medicationName: string; timeOfDay: string; timestamp: string }) => {
          handlersRef.current.toast.critical(`⚠️ ${d.patientName} missed ${d.medicationName} (${d.timeOfDay})`, 10000);
          setMissedAlerts((prev) => [{ ...d, id: Date.now() + Math.random() }, ...prev].slice(0, 20));
          refreshCaregiverData();
        },
      );

      socket.on('escalation_alert', (d: { message: string }) => {
        handlersRef.current.toast.critical(`🚨 Critical: ${d.message}`, 12000);
        refreshCaregiverData();
      });

      socket.on('mood_update', (d: { patientName: string; mood: string }) => {
        handlersRef.current.toast.info(`🧠 Mood Alert: ${d.patientName} is feeling ${d.mood}`, 6000);
        refreshCaregiverData();
      });

      socket.on('patient_dose_update', (d: { patientName: string; medicationName: string; timeOfDay: string; status: string }) => {
        const emoji = d.status === 'taken' ? '✅' : d.status === 'skipped' ? '❌' : '⏱️';
        const label = d.status === 'taken' ? 'took' : d.status === 'skipped' ? 'skipped' : 'delayed';
        const variant = d.status === 'taken' ? 'success' : d.status === 'skipped' ? 'error' : 'warning';
        handlersRef.current.toast.show(`${emoji} ${d.patientName} ${label} ${d.medicationName} (${d.timeOfDay})`, variant, 6000);
        refreshCaregiverData();
      });

      socket.on('cognitive_alert', (d: { patientName: string; declinePercent: number }) => {
        handlersRef.current.toast.warning(`🧠 Cognitive Decline Alert: ${d.patientName} declined by ${d.declinePercent}%`, 8000);
        refreshCaregiverData();
      });

      socket.on('behavioral_alert', refreshCaregiverData);
      socket.on('medication_added', refreshCaregiverData);
      socket.on('medication_logged', () => invalidate(['caregiver']));
    }

    // Mobile OSes drop sockets in the background — reconnect on resume.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !socket.connected) socket.connect();
    });

    return () => {
      appStateSub.remove();
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [isAuthenticated, userId, role, queryClient]);

  const value = useMemo(
    () => ({
      connected,
      missedAlerts,
      dismissMissedAlert: (id: number) => setMissedAlerts((prev) => prev.filter((a) => a.id !== id)),
    }),
    [connected, missedAlerts],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketValue {
  return useContext(SocketContext);
}
