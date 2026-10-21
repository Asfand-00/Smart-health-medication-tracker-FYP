import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { ApiError } from './client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retry transient failures only; 4xx answers will not change on retry.
      retry: (failureCount, error) => {
        // Not 'timeout': that request already waited REQUEST_TIMEOUT_MS; retrying would triple the wait.
        if (error instanceof ApiError && ['network', 'server'].includes(error.kind)) {
          return failureCount < 2;
        }
        return false;
      },
    },
    mutations: { retry: false },
  },
});

/** Pause queries while offline and refetch on reconnect. */
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(state.isConnected !== false);
  }),
);

/** Treat "app came to foreground" like a browser window regaining focus. */
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });
}

export const qk = {
  me: ['me'] as const,
  medications: ['medications'] as const,
  medicationStats: ['medications', 'stats'] as const,
  medicationHistory: (range: string) => ['medications', 'history', range] as const,
  medicationCalendar: (patientId: string, month: string) => ['medications', 'calendar', patientId, month] as const,
  drugSearch: (q: string) => ['drugs', 'search', q] as const,
  drugInfo: (name: string) => ['drugs', 'info', name] as const,
  interactions: (patientId: string) => ['drugs', 'interactions', patientId] as const,
  templates: ['templates'] as const,
  planRequests: (patientId: string) => ['plans', 'requests', patientId] as const,
  planPending: ['plans', 'pending'] as const,
  vitalsLatest: ['vitals', 'latest'] as const,
  vitalsHistory: ['vitals', 'history'] as const,
  vitalsToday: ['vitals', 'today'] as const,
  patientProfile: ['patient', 'profile'] as const,
  patientConditions: (patientId: string) => ['patient', 'conditions', patientId] as const,
  careTeam: ['careTeam'] as const,
  doctors: ['doctors'] as const,
  reminders: ['reminders'] as const,
  smartReminders: ['smartReminders'] as const,
  reminderPreferences: ['smartReminders', 'preferences'] as const,
  reminderSuggestions: ['smartReminders', 'suggestions'] as const,
  adherenceToday: (patientId?: string) => ['adherence', 'today', patientId ?? 'me'] as const,
  adherenceWeekly: (patientId?: string) => ['adherence', 'weekly', patientId ?? 'me'] as const,
  adherenceHistory: (filters: object) => ['adherence', 'history', filters] as const,
  notifications: (filters: object) => ['notifications', 'list', filters] as const,
  unreadCount: ['notifications', 'unread'] as const,
  notificationSettings: ['notifications', 'settings'] as const,
  pushTokens: ['notifications', 'pushTokens'] as const,
  mood: (patientId: string) => ['mood', patientId] as const,
  emergencyContacts: (patientId: string) => ['emergencyContacts', patientId] as const,
  reports: (patientId: string) => ['reports', patientId] as const,
  healthTrends: (patientId: string, days: number) => ['reports', 'trends', patientId, days] as const,
  analyticsInsights: (patientId: string) => ['reports', 'insights', patientId] as const,
  performance: (patientId: string) => ['reports', 'performance', patientId] as const,
  prescriptions: (patientId: string, status: string) => ['prescriptions', patientId, status] as const,
  prescription: (id: string) => ['prescriptions', 'one', id] as const,
  prescriptionHistory: (id: string) => ['prescriptions', 'history', id] as const,
  aiInsights: (patientId: string) => ['ai', 'insights', patientId] as const,
  aiAlerts: (patientId: string) => ['ai', 'alerts', patientId] as const,
  auditMe: ['audit', 'me'] as const,
  // caregiver
  caregiverPatients: ['caregiver', 'patients'] as const,
  caregiverRequests: ['caregiver', 'requests'] as const,
  caregiverOverview: ['caregiver', 'overview'] as const,
  caregiverAlerts: ['caregiver', 'alerts'] as const,
  patientRecords: (id: string) => ['caregiver', 'records', id] as const,
  patientMedications: (id: string) => ['caregiver', 'medications', id] as const,
  patientTimeline: (id: string) => ['caregiver', 'timeline', id] as const,
  patientAdherence: (id: string) => ['caregiver', 'adherence', id] as const,
  notes: (id: string) => ['caregiver', 'notes', id] as const,
  cognitive: (id: string) => ['caregiver', 'cognitive', id] as const,
  // doctor
  doctorDashboard: ['doctor', 'dashboard'] as const,
  doctorRequests: ['doctor', 'requests'] as const,
  doctorPatients: ['doctor', 'patients'] as const,
  doctorOverview: (id: string) => ['doctor', 'overview', id] as const,
  doctorNotes: (id: string) => ['doctor', 'notes', id] as const,
  // admin
  adminUsers: ['admin', 'users'] as const,
  adminUsersPage: (filters: object) => ['admin', 'users', 'page', filters] as const,
  adminUser: (id: string) => ['admin', 'user', id] as const,
  adminDashboard: ['admin', 'dashboard'] as const,
  adminNotifications: (filters: object) => ['admin', 'notifications', filters] as const,
  adminAlerts: ['admin', 'alerts'] as const,
  adminReports: ['admin', 'reports'] as const,
  adminConfig: ['admin', 'config'] as const,
  adminAudit: (filters: object) => ['admin', 'audit', filters] as const,
  adminAuditStats: ['admin', 'audit', 'stats'] as const,
};
