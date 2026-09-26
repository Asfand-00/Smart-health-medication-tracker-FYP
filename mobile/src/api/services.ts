/**
 * Endpoint wrappers — one-to-one with frontend/src/api/*.service.js, typed.
 * No endpoint here is new: every path exists in backend/src/features/**.routes.js.
 */
import { api, unwrap } from './client';
import type {
  AckStatus,
  AdherenceHistoryPage,
  AdherenceLog,
  AdherenceReport,
  AdminUser,
  AdminUserUpdatePayload,
  AppNotification,
  AuthResult,
  BehavioralObservationPayload,
  CaregiverIncomingRequest,
  CaregiverNote,
  CaregiverNotePayload,
  CaregiverOverviewPatient,
  CaregiverPatient,
  CognitiveAssessment,
  CognitiveAssessmentPayload,
  EmergencyContact,
  EmergencyContactPayload,
  Medication,
  MedicationHistoryEntry,
  MedicationPayload,
  MedicationsReport,
  MedicationStats,
  MoodLog,
  MoodPayload,
  NotificationPage,
  PatientAdherenceBundle,
  PatientProfile,
  PatientProfilePayload,
  PatientRecords,
  PatientSentRequest,
  PdfReadyReport,
  ProfileUpdatePayload,
  RegisterPayload,
  Reminder,
  RiskAnalysisReport,
  TimelineEvent,
  TimeOfDay,
  TodayStatus,
  TodayVitalsCheck,
  User,
  UserRef,
  Vitals,
  VitalsPayload,
  WeeklyReport,
} from '../types/models';

// ── auth (AuthContext.jsx) ─────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) => unwrap<AuthResult>(api.post('/auth/login', { email, password })),
  register: (payload: RegisterPayload) => unwrap<AuthResult>(api.post('/auth/register', payload)),
  me: () => unwrap<{ user: User }>(api.get('/auth/me')).then((d) => d.user),
};

// ── user profile (ProfilePage.jsx) & admin (admin.service.js) ─────────────
export const userApi = {
  updateProfile: (payload: ProfileUpdatePayload) =>
    unwrap<{ user: User }>(api.put('/user/profile', payload)).then((d) => d.user),
};

export const adminApi = {
  getAllUsers: () => unwrap<{ users: AdminUser[] }>(api.get('/user/all')).then((d) => d.users),
  updateUser: (id: string, payload: AdminUserUpdatePayload) =>
    unwrap<{ user: User }>(api.put(`/user/${id}`, payload)).then((d) => d.user),
  deleteUser: (id: string) => api.delete(`/user/${id}`).then(() => undefined),
};

// ── patient medical profile (patient.service.js) ──────────────────────────
export const patientApi = {
  getProfile: () => unwrap<PatientProfile>(api.get('/patient/profile')),
  upsertProfile: (payload: PatientProfilePayload) => unwrap<PatientProfile>(api.put('/patient/profile', payload)),
};

// ── medications (medication.service.js) ───────────────────────────────────
export const medicationApi = {
  getAll: () => unwrap<Medication[]>(api.get('/medication')),
  add: (payload: MedicationPayload) => unwrap<Medication>(api.post('/medication', payload)),
  update: (id: string, payload: MedicationPayload) => unwrap<Medication>(api.put(`/medication/${id}`, payload)),
  remove: (id: string) => api.delete(`/medication/${id}`).then(() => undefined),
  logDose: (id: string, body: { date: string; timeOfDay: TimeOfDay; status: 'taken' | 'missed' }) =>
    unwrap<MedicationHistoryEntry>(api.post(`/medication/${id}/log`, body)),
  getHistory: (params: { startDate?: string; endDate?: string } = {}) =>
    unwrap<MedicationHistoryEntry[]>(api.get('/medication/history', { params })),
  getStats: () => unwrap<MedicationStats>(api.get('/medication/stats')),
};

// ── vitals (vitals.service.js) ────────────────────────────────────────────
export const vitalsApi = {
  getLatest: () => unwrap<Vitals | null>(api.get('/vitals')),
  getHistory: () => unwrap<Vitals[]>(api.get('/vitals/history')),
  // This endpoint puts `hasLoggedToday` beside `data`, not inside it.
  checkToday: () => api.get<TodayVitalsCheck>('/vitals/today-check').then((r) => r.data),
  add: (payload: VitalsPayload) => unwrap<Vitals>(api.post('/vitals', payload)),
  remove: (id: string) => api.delete(`/vitals/${id}`).then(() => undefined),
};

// ── care team / caregiver (caregiver.service.js) ──────────────────────────
export const caregiverApi = {
  getAvailableCaregivers: () => unwrap<UserRef[]>(api.get('/caregiver/available')),
  requestCaregiver: (caregiverId: string) => unwrap<unknown>(api.post('/caregiver/request', { caregiverId })),
  getMyTeam: () => unwrap<UserRef[]>(api.get('/caregiver/my-team')),
  getPatientRequests: () => unwrap<PatientSentRequest[]>(api.get('/caregiver/patient-requests')),

  getCaregiverRequests: () => unwrap<CaregiverIncomingRequest[]>(api.get('/caregiver/requests')),
  handleRequest: (requestId: string, status: 'accepted' | 'declined') =>
    unwrap<unknown>(api.post(`/caregiver/requests/${requestId}/handle`, { status })),
  getPatients: () => unwrap<CaregiverPatient[]>(api.get('/caregiver/patients')),
  removePatient: (patientUserId: string) => api.delete(`/caregiver/patients/${patientUserId}`).then(() => undefined),
  getPatientRecords: (patientUserId: string) => unwrap<PatientRecords>(api.get(`/caregiver/patients/${patientUserId}/records`)),
  /**
   * The web dashboard reads medications from /records, which queries
   * Medication by the *user* id against a field holding the *Patient* id and so
   * always returns []. This existing endpoint queries by userId and is correct.
   */
  getPatientMedications: (patientUserId: string) =>
    unwrap<Medication[]>(api.get(`/caregiver/patients/${patientUserId}/medications`)),
  addPatientMedication: (patientUserId: string, payload: MedicationPayload) =>
    unwrap<Medication>(api.post(`/caregiver/patients/${patientUserId}/medications`, payload)),
  updatePatientMedication: (patientUserId: string, medId: string, payload: MedicationPayload) =>
    unwrap<Medication>(api.put(`/caregiver/patients/${patientUserId}/medications/${medId}`, payload)),
  deletePatientMedication: (patientUserId: string, medId: string) =>
    api.delete(`/caregiver/patients/${patientUserId}/medications/${medId}`).then(() => undefined),
  logPatientDose: (patientUserId: string, medId: string, body: { date: string; timeOfDay: TimeOfDay; status: 'taken' }) =>
    unwrap<AdherenceLog>(api.post(`/caregiver/patients/${patientUserId}/medications/${medId}/log`, body)),
};

// ── caregiver dashboard (caregiverDashboard.service.js) ───────────────────
export const caregiverDashboardApi = {
  getOverview: () => unwrap<CaregiverOverviewPatient[]>(api.get('/caregiver-dashboard/overview')),
  getAlerts: () => unwrap<AppNotification[]>(api.get('/caregiver-dashboard/alerts')),
  getPatientTimeline: (patientUserId: string) =>
    unwrap<TimelineEvent[]>(api.get(`/caregiver-dashboard/patients/${patientUserId}/timeline`)),
  getPatientAdherence: (patientUserId: string) =>
    unwrap<PatientAdherenceBundle>(api.get(`/caregiver-dashboard/patients/${patientUserId}/adherence`)),

  addNote: (payload: CaregiverNotePayload) => unwrap<CaregiverNote>(api.post('/caregiver-dashboard/notes', payload)),
  getNotes: (patientUserId: string) => unwrap<CaregiverNote[]>(api.get(`/caregiver-dashboard/notes/${patientUserId}`)),
  updateNote: (id: string, payload: CaregiverNotePayload) =>
    unwrap<CaregiverNote>(api.put(`/caregiver-dashboard/notes/${id}`, payload)),
  deleteNote: (id: string) => api.delete(`/caregiver-dashboard/notes/${id}`).then(() => undefined),

  logCognitiveAssessment: (payload: CognitiveAssessmentPayload) =>
    unwrap<CognitiveAssessment>(api.post('/caregiver-dashboard/cognitive-assessment', payload)),
  getCognitiveAssessments: (patientUserId: string) =>
    unwrap<CognitiveAssessment[]>(api.get(`/caregiver-dashboard/cognitive-assessments/${patientUserId}`)),

  logBehavioralObservation: (payload: BehavioralObservationPayload) =>
    unwrap<unknown>(api.post('/caregiver-dashboard/behavioral-observation', payload)),

  logMood: (payload: MoodPayload) => unwrap<MoodLog>(api.post('/caregiver-dashboard/mood', payload)),
  getMoodHistory: (patientUserId: string) => unwrap<MoodLog[]>(api.get(`/caregiver-dashboard/mood/${patientUserId}`)),

  addEmergencyContact: (payload: EmergencyContactPayload) =>
    unwrap<EmergencyContact>(api.post('/caregiver-dashboard/emergency-contacts', payload)),
  getEmergencyContacts: (patientUserId: string) =>
    unwrap<EmergencyContact[]>(api.get(`/caregiver-dashboard/emergency-contacts/${patientUserId}`)),
  updateEmergencyContact: (id: string, payload: EmergencyContactPayload) =>
    unwrap<EmergencyContact>(api.put(`/caregiver-dashboard/emergency-contacts/${id}`, payload)),
  deleteEmergencyContact: (id: string) =>
    api.delete(`/caregiver-dashboard/emergency-contacts/${id}`).then(() => undefined),
};

// ── reminders (reminder.service.js) ───────────────────────────────────────
export const reminderApi = {
  getMine: () => unwrap<Reminder[]>(api.get('/reminders')),
  markAsRead: (id: string) => unwrap<Reminder>(api.patch(`/reminders/${id}/read`)),
  poke: (patientUserId: string) => unwrap<Reminder>(api.post('/reminders/poke', { patientUserId })),
};

// ── smart reminders (smartReminder.service.js) ────────────────────────────
export const smartReminderApi = {
  generate: () => unwrap<Reminder[]>(api.post('/smart-reminders/generate')),
  getUpcoming: () => unwrap<Reminder[]>(api.get('/smart-reminders/upcoming')),
  acknowledge: (id: string, status: AckStatus) => unwrap<unknown>(api.post(`/smart-reminders/acknowledge/${id}`, { status })),
};

// ── adherence (adherence.service.js) ──────────────────────────────────────
export const adherenceApi = {
  confirmDose: (body: {
    patientUserId?: string;
    medicationId: string;
    timeOfDay: TimeOfDay;
    status: 'taken' | 'skipped';
    notes?: string;
  }) => unwrap<AdherenceLog>(api.post('/adherence/confirm', body)),
  getToday: (patientId?: string) =>
    unwrap<TodayStatus>(api.get('/adherence/today', { params: patientId ? { patientId } : {} })),
  getWeekly: (patientId?: string, weeksBack = 0) =>
    unwrap<WeeklyReport>(api.get('/adherence/weekly', { params: { weeksBack, ...(patientId ? { patientId } : {}) } })),
  getHistory: (params: {
    medicationId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page: number;
    limit: number;
    patientId?: string;
  }) => {
    // Send only filters that are set; the backend treats '' as a real filter value.
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined));
    return unwrap<AdherenceHistoryPage>(api.get('/adherence/history', { params: clean }));
  },
  /** Raw CSV text (the endpoint answers text/csv, not the JSON envelope). */
  exportCsv: (patientId?: string) =>
    api
      .get<string>('/adherence/export', {
        params: { format: 'csv', ...(patientId ? { patientId } : {}) },
        responseType: 'text',
        transformResponse: (d) => d,
      })
      .then((r) => r.data),
};

// ── notifications (notification.service.js) ──────────────────────────────
export const notificationApi = {
  /**
   * The web inbox sends type/priority filters to GET /notifications, which
   * ignores them. GET /notifications/history is the existing endpoint that
   * actually applies those filters, so the mobile inbox uses it.
   */
  getHistory: (params: { type?: string; priority?: string; page?: number; limit?: number }) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined));
    return unwrap<NotificationPage>(api.get('/notifications/history', { params: clean }));
  },
  getUnreadCount: () => unwrap<{ unreadCount: number }>(api.get('/notifications/unread-count')).then((d) => d.unreadCount),
  markAsRead: (id: string) => unwrap<AppNotification>(api.patch(`/notifications/${id}/read`)),
  markAllAsRead: () => api.patch('/notifications/read-all').then(() => undefined),
  remove: (id: string) => api.delete(`/notifications/${id}`).then(() => undefined),
};

// ── reports (reports.service.js) ──────────────────────────────────────────
export const reportsApi = {
  getAdherence: (patientId?: string) =>
    unwrap<AdherenceReport>(api.get('/reports/adherence', { params: patientId ? { patientId } : {} })),
  getMedications: (patientId?: string) =>
    unwrap<MedicationsReport>(api.get('/reports/medications', { params: patientId ? { patientId } : {} })),
  getRiskAnalysis: (patientId: string) =>
    unwrap<RiskAnalysisReport>(api.get('/reports/risk-analysis', { params: { patientId } })),
  getPdfReady: (patientId?: string) =>
    unwrap<PdfReadyReport>(api.get('/reports/export/pdf', { params: patientId ? { patientId } : {} })),
};
