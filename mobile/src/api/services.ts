/**
 * Endpoint wrappers — typed, one per backend route group.
 * Every path here exists in backend/src/features/**.routes.js.
 */
import { Platform } from 'react-native';

import { api, unwrap } from './client';
import type {
  AckStatus,
  AdaptiveSuggestion,
  AdherenceHistoryPage,
  AdherenceLog,
  AdherenceReport,
  AdminAlerts,
  AdminCreateUserPayload,
  AdminDashboard,
  AdminNotificationsPage,
  AdminReportsOverview,
  AdminUser,
  AdminUserDetail,
  AdminUsersPage,
  AdminUserUpdatePayload,
  AiAccuracy,
  AiAlert,
  AiInsights,
  AnalyticsInsights,
  AppNotification,
  AuditPage,
  AuditStats,
  AuthResult,
  BehavioralObservationPayload,
  BroadcastPayload,
  CalendarMonth,
  CaregiverIncomingRequest,
  CaregiverNote,
  CaregiverNotePayload,
  CaregiverOverviewPatient,
  CaregiverPatient,
  CognitiveAssessment,
  CognitiveAssessmentPayload,
  CsvExportType,
  DoctorDashboard,
  DoctorNote,
  DoctorNotePayload,
  DoctorPatientLink,
  DoctorPatientOverview,
  DoctorPatientRow,
  DoctorRef,
  DrugInfo,
  DrugSummary,
  EmergencyContact,
  EmergencyContactPayload,
  ForgotPasswordResult,
  HealthCondition,
  HealthConditionPayload,
  HealthTrends,
  InteractionCheck,
  Medication,
  MedicationHistoryEntry,
  MedicationPayload,
  MedicationPlanRequest,
  MedicationsReport,
  MedicationStats,
  MedicationTemplate,
  MoodLog,
  MoodPayload,
  NotificationPage,
  NotificationSettings,
  NotificationSettingsPayload,
  ParsedPrescription,
  PatientAdherenceBundle,
  PatientProfile,
  PatientProfilePayload,
  PatientRecords,
  PatientSentRequest,
  PdfReadyReport,
  PerformanceReport,
  PickedFile,
  PlanRequestPayload,
  PrescribedMedication,
  Prescription,
  PrescriptionFormFields,
  PrescriptionHistoryEntry,
  ProfileUpdatePayload,
  PushTokenInfo,
  RegisterPayload,
  Reminder,
  ReminderPreferences,
  RiskAnalysisReport,
  SystemConfig,
  SystemConfigPayload,
  TemplateItem,
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

const clean = (params: Record<string, unknown>) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null));
const withPatient = (patientId?: string, extra: Record<string, unknown> = {}) => clean({ ...extra, ...(patientId ? { patientId } : {}) });
const rawText = (url: string, params: Record<string, unknown> = {}) =>
  api.get<string>(url, { params: clean(params), responseType: 'text', transformResponse: (d) => d }).then((r) => r.data);

// ── auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) => unwrap<AuthResult>(api.post('/auth/login', { email, password })),
  register: (payload: RegisterPayload) => unwrap<AuthResult>(api.post('/auth/register', payload)),
  me: () => unwrap<{ user: User }>(api.get('/auth/me')).then((d) => d.user),
  changePassword: (currentPassword: string, newPassword: string) =>
    unwrap<AuthResult>(api.put('/auth/change-password', { currentPassword, newPassword })),
  forgotPassword: (email: string) => unwrap<ForgotPasswordResult>(api.post('/auth/forgot-password', { email })),
  resetPassword: (email: string, code: string, newPassword: string) =>
    unwrap<AuthResult>(api.post('/auth/reset-password', { email, code, newPassword })),
  logout: (everywhere = false) => api.post('/auth/logout', { everywhere }).then(() => undefined),
};

// ── user profile & privacy ────────────────────────────────────────────────
export const userApi = {
  updateProfile: (payload: ProfileUpdatePayload & { speciality?: string; licenseNumber?: string }) =>
    unwrap<{ user: User }>(api.put('/user/profile', payload)).then((d) => d.user),
  updateRecovery: (payload: { recoveryEmail?: string; phone?: string }) =>
    unwrap<{ user: User }>(api.put('/user/recovery', payload)).then((d) => d.user),
  exportData: () => unwrap<Record<string, unknown>>(api.get('/user/export')),
  deleteAccount: (password: string) => api.delete('/user/me', { data: { password } }).then(() => undefined),
  consent: () => unwrap<{ user: User }>(api.post('/user/consent')).then((d) => d.user),
};

export const auditApi = {
  mine: (params: { page?: number; limit?: number; category?: string } = {}) => unwrap<AuditPage>(api.get('/audit/me', { params: clean(params) })),
  list: (params: Record<string, unknown> = {}) => unwrap<AuditPage>(api.get('/audit', { params: clean(params) })),
  stats: (days = 7) => unwrap<AuditStats>(api.get('/audit/stats', { params: { days } })),
};

// ── admin ─────────────────────────────────────────────────────────────────
export const adminApi = {
  getAllUsers: () => unwrap<{ users: AdminUser[] }>(api.get('/user/all')).then((d) => d.users),
  updateUser: (id: string, payload: AdminUserUpdatePayload) =>
    unwrap<{ user: User }>(api.put(`/user/${id}`, payload)).then((d) => d.user),
  deleteUser: (id: string) => api.delete(`/user/${id}`).then(() => undefined),

  dashboard: () => unwrap<AdminDashboard>(api.get('/admin/dashboard')),
  users: (params: { search?: string; role?: string; status?: string; page?: number; limit?: number }) =>
    unwrap<AdminUsersPage>(api.get('/admin/users', { params: clean(params) })),
  user: (id: string) => unwrap<AdminUserDetail>(api.get(`/admin/users/${id}`)),
  createUser: (payload: AdminCreateUserPayload) => unwrap<{ user: User }>(api.post('/admin/users', payload)).then((d) => d.user),
  setStatus: (id: string, isActive: boolean) => unwrap<{ user: User }>(api.put(`/admin/users/${id}/status`, { isActive })).then((d) => d.user),
  setRole: (id: string, role: string) => unwrap<{ user: User }>(api.put(`/admin/users/${id}/role`, { role })).then((d) => d.user),
  resetPassword: (id: string, newPassword?: string) =>
    unwrap<{ expiresInMinutes?: number; devCode?: string } | undefined>(api.post(`/admin/users/${id}/reset-password`, newPassword ? { newPassword } : {})),
  unlock: (id: string) => api.post(`/admin/users/${id}/unlock`).then(() => undefined),
  broadcast: (payload: BroadcastPayload) => unwrap<{ broadcastId: string; recipients: number }>(api.post('/admin/notifications/broadcast', payload)),
  notifications: (params: { type?: string; priority?: string; failed?: string; page?: number; limit?: number }) =>
    unwrap<AdminNotificationsPage>(api.get('/admin/notifications', { params: clean(params) })),
  deleteNotification: (id: string) => api.delete(`/admin/notifications/${id}`).then(() => undefined),
  alerts: () => unwrap<AdminAlerts>(api.get('/admin/alerts')),
  reportsOverview: (months = 6) => unwrap<AdminReportsOverview>(api.get('/admin/reports/overview', { params: { months } })),
  exportCsv: (type: 'users' | 'adherence' | 'audit') => rawText('/admin/reports/export', { type }),
  getConfig: () => unwrap<SystemConfig>(api.get('/admin/config')),
  updateConfig: (payload: SystemConfigPayload) => unwrap<SystemConfig>(api.put('/admin/config', payload)),
  runJob: (name: string) => unwrap<unknown>(api.post(`/admin/jobs/${name}`)),
};

// ── patient medical profile & conditions ──────────────────────────────────
export const patientApi = {
  getProfile: () => unwrap<PatientProfile>(api.get('/patient/profile')),
  upsertProfile: (payload: PatientProfilePayload) => unwrap<PatientProfile>(api.put('/patient/profile', payload)),
  getProfileFor: (patientUserId: string) => unwrap<{ user: UserRef; profile: PatientProfile | null }>(api.get(`/patient/${patientUserId}/profile`)),
  /** Conditions: patient uses the own-routes; caregivers/doctors pass the patient id. */
  listConditions: (patientUserId?: string) =>
    unwrap<HealthCondition[]>(api.get(patientUserId ? `/patient/${patientUserId}/conditions` : '/patient/conditions')),
  addCondition: (payload: HealthConditionPayload, patientUserId?: string) =>
    unwrap<HealthCondition>(api.post(patientUserId ? `/patient/${patientUserId}/conditions` : '/patient/conditions', payload)),
  updateCondition: (id: string, payload: HealthConditionPayload, patientUserId?: string) =>
    unwrap<HealthCondition>(api.put(patientUserId ? `/patient/${patientUserId}/conditions/${id}` : `/patient/conditions/${id}`, payload)),
  deleteCondition: (id: string, patientUserId?: string) =>
    api.delete(patientUserId ? `/patient/${patientUserId}/conditions/${id}` : `/patient/conditions/${id}`).then(() => undefined),
};

// ── medications ───────────────────────────────────────────────────────────
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
  calendar: (month: string, patientId?: string) => unwrap<CalendarMonth>(api.get('/medication/calendar', { params: withPatient(patientId, { month }) })),
  searchDrugs: (q: string) => unwrap<DrugSummary[]>(api.get('/medication/drug-info', { params: clean({ q }) })),
  drugInfo: (name: string) => unwrap<DrugInfo>(api.get(`/medication/drug-info/${encodeURIComponent(name)}`)),
  interactions: (patientId?: string, names?: string[]) =>
    unwrap<InteractionCheck>(api.get('/medication/interactions', { params: withPatient(patientId, { names: names?.join(',') }) })),
};

export const templateApi = {
  list: () => unwrap<MedicationTemplate[]>(api.get('/medication-templates')),
  create: (payload: { name: string; description?: string; category?: string; items: TemplateItem[]; isGlobal?: boolean }) =>
    unwrap<MedicationTemplate>(api.post('/medication-templates', payload)),
  remove: (id: string) => api.delete(`/medication-templates/${id}`).then(() => undefined),
  apply: (id: string, patientUserId?: string, itemIds?: string[]) =>
    unwrap<{ created: Medication[]; skipped: number }>(api.post(`/medication-templates/${id}/apply`, clean({ patientUserId, itemIds }))),
};

export const planApi = {
  create: (payload: PlanRequestPayload) => unwrap<MedicationPlanRequest>(api.post('/medication-plans/requests', payload)),
  mine: (patientId?: string, status?: string) =>
    unwrap<MedicationPlanRequest[]>(api.get('/medication-plans/requests', { params: withPatient(patientId, { status }) })),
  pending: (status = 'pending') => unwrap<MedicationPlanRequest[]>(api.get('/medication-plans/pending', { params: { status } })),
  review: (id: string, status: 'approved' | 'rejected', note?: string) =>
    unwrap<MedicationPlanRequest>(api.post(`/medication-plans/requests/${id}/review`, { status, note })),
  cancel: (id: string) => unwrap<MedicationPlanRequest>(api.delete(`/medication-plans/requests/${id}`)),
};

// ── vitals ────────────────────────────────────────────────────────────────
export const vitalsApi = {
  getLatest: () => unwrap<Vitals | null>(api.get('/vitals')),
  getHistory: () => unwrap<Vitals[]>(api.get('/vitals/history')),
  checkToday: () => api.get<TodayVitalsCheck>('/vitals/today-check').then((r) => r.data),
  add: (payload: VitalsPayload) => unwrap<Vitals>(api.post('/vitals', payload)),
  remove: (id: string) => api.delete(`/vitals/${id}`).then(() => undefined),
};

// ── care team / caregiver ─────────────────────────────────────────────────
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

// ── doctor ────────────────────────────────────────────────────────────────
export const doctorApi = {
  // patient side
  available: () => unwrap<DoctorRef[]>(api.get('/doctor/available')),
  request: (doctorId: string, message?: string) => unwrap<DoctorPatientLink>(api.post('/doctor/request', { doctorId, message })),
  myDoctors: () => unwrap<DoctorRef[]>(api.get('/doctor/my-doctor')),
  myRequests: () => unwrap<DoctorPatientLink[]>(api.get('/doctor/my-requests')),
  // doctor side
  dashboard: () => unwrap<DoctorDashboard>(api.get('/doctor/dashboard')),
  requests: () => unwrap<DoctorPatientLink[]>(api.get('/doctor/requests')),
  handleRequest: (id: string, status: 'accepted' | 'declined') => unwrap<DoctorPatientLink>(api.post(`/doctor/requests/${id}/handle`, { status })),
  patients: () => unwrap<DoctorPatientRow[]>(api.get('/doctor/patients')),
  removePatient: (patientUserId: string) => api.delete(`/doctor/patients/${patientUserId}`).then(() => undefined),
  overview: (patientUserId: string) => unwrap<DoctorPatientOverview>(api.get(`/doctor/patients/${patientUserId}/overview`)),
  medications: (patientUserId: string) => unwrap<Medication[]>(api.get(`/doctor/patients/${patientUserId}/medications`)),
  addMedication: (patientUserId: string, payload: MedicationPayload) => unwrap<Medication>(api.post(`/doctor/patients/${patientUserId}/medications`, payload)),
  updateMedication: (patientUserId: string, medId: string, payload: MedicationPayload) =>
    unwrap<Medication>(api.put(`/doctor/patients/${patientUserId}/medications/${medId}`, payload)),
  deleteMedication: (patientUserId: string, medId: string) => api.delete(`/doctor/patients/${patientUserId}/medications/${medId}`).then(() => undefined),
  addNote: (payload: DoctorNotePayload) => unwrap<DoctorNote>(api.post('/doctor/notes', payload)),
  notes: (patientUserId: string) => unwrap<DoctorNote[]>(api.get(`/doctor/notes/${patientUserId}`)),
  updateNote: (id: string, payload: Partial<DoctorNotePayload>) => unwrap<DoctorNote>(api.put(`/doctor/notes/${id}`, payload)),
  deleteNote: (id: string) => api.delete(`/doctor/notes/${id}`).then(() => undefined),
};

// ── caregiver dashboard ───────────────────────────────────────────────────
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

// ── reminders ─────────────────────────────────────────────────────────────
export const reminderApi = {
  getMine: () => unwrap<Reminder[]>(api.get('/reminders')),
  markAsRead: (id: string) => unwrap<Reminder>(api.patch(`/reminders/${id}/read`)),
  poke: (patientUserId: string) => unwrap<Reminder>(api.post('/reminders/poke', { patientUserId })),
};

export const smartReminderApi = {
  generate: () => unwrap<Reminder[]>(api.post('/smart-reminders/generate')),
  getUpcoming: () => unwrap<Reminder[]>(api.get('/smart-reminders/upcoming')),
  acknowledge: (id: string, status: AckStatus) => unwrap<unknown>(api.post(`/smart-reminders/acknowledge/${id}`, { status })),
  getPreferences: () => unwrap<ReminderPreferences>(api.get('/smart-reminders/preferences')),
  updatePreferences: (payload: { reminderTimes?: Partial<Record<TimeOfDay, string>>; reminderLeadMinutes?: number; voiceAlerts?: boolean }) =>
    unwrap<ReminderPreferences>(api.put('/smart-reminders/preferences', payload)),
  getSuggestions: () => unwrap<{ suggestions: AdaptiveSuggestion[]; message: string }>(api.get('/smart-reminders/suggestions')),
  applySuggestion: (timeOfDay: TimeOfDay, suggestedTime: string) =>
    unwrap<{ reminderTimes: Record<TimeOfDay, string> }>(api.post('/smart-reminders/suggestions/apply', { timeOfDay, suggestedTime })),
};

// ── adherence ─────────────────────────────────────────────────────────────
export const adherenceApi = {
  confirmDose: (body: {
    patientUserId?: string;
    medicationId: string;
    timeOfDay: TimeOfDay;
    status: 'taken' | 'skipped';
    notes?: string;
  }) => unwrap<AdherenceLog>(api.post('/adherence/confirm', body)),
  getToday: (patientId?: string) =>
    unwrap<TodayStatus>(api.get('/adherence/today', { params: withPatient(patientId) })),
  getWeekly: (patientId?: string, weeksBack = 0) =>
    unwrap<WeeklyReport>(api.get('/adherence/weekly', { params: withPatient(patientId, { weeksBack }) })),
  getHistory: (params: {
    medicationId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page: number;
    limit: number;
    patientId?: string;
  }) => unwrap<AdherenceHistoryPage>(api.get('/adherence/history', { params: clean(params) })),
  exportCsv: (patientId?: string) => rawText('/adherence/export', withPatient(patientId, { format: 'csv' })),
};

// ── notifications ─────────────────────────────────────────────────────────
export const notificationApi = {
  getHistory: (params: { type?: string; priority?: string; isRead?: string; page?: number; limit?: number }) =>
    unwrap<NotificationPage>(api.get('/notifications/history', { params: clean(params) })),
  getUnreadCount: () => unwrap<{ unreadCount: number }>(api.get('/notifications/unread-count')).then((d) => d.unreadCount),
  markAsRead: (id: string) => unwrap<AppNotification>(api.patch(`/notifications/${id}/read`)),
  markAllAsRead: () => api.patch('/notifications/read-all').then(() => undefined),
  remove: (id: string) => api.delete(`/notifications/${id}`).then(() => undefined),
  getSettings: () => unwrap<NotificationSettings>(api.get('/notifications/settings')),
  updateSettings: (payload: NotificationSettingsPayload) => unwrap<NotificationSettings>(api.put('/notifications/settings', payload)),
  registerPushToken: (token: string, platform: string, deviceName?: string) =>
    unwrap<PushTokenInfo>(api.post('/notifications/push-token', { token, platform, deviceName })),
  removePushToken: (token?: string) => api.delete('/notifications/push-token', { data: { token } }).then(() => undefined),
  pushTokens: () => unwrap<PushTokenInfo[]>(api.get('/notifications/push-tokens')),
  sendTest: (priority: 'normal' | 'high' = 'normal') => unwrap<AppNotification>(api.post('/notifications/test', { priority })),
};

// ── reports & analytics ───────────────────────────────────────────────────
export const reportsApi = {
  getAdherence: (patientId?: string) =>
    unwrap<AdherenceReport>(api.get('/reports/adherence', { params: withPatient(patientId) })),
  getMedications: (patientId?: string) =>
    unwrap<MedicationsReport>(api.get('/reports/medications', { params: withPatient(patientId) })),
  getRiskAnalysis: (patientId: string) =>
    unwrap<RiskAnalysisReport>(api.get('/reports/risk-analysis', { params: { patientId } })),
  getPdfReady: (patientId?: string) =>
    unwrap<PdfReadyReport>(api.get('/reports/export/pdf', { params: withPatient(patientId) })),
  healthTrends: (patientId?: string, days = 30) => unwrap<HealthTrends>(api.get('/reports/health-trends', { params: withPatient(patientId, { days }) })),
  insights: (patientId?: string, days = 30) => unwrap<AnalyticsInsights>(api.get('/reports/insights', { params: withPatient(patientId, { days }) })),
  performance: (patientId?: string, months = 6) => unwrap<PerformanceReport>(api.get('/reports/performance', { params: withPatient(patientId, { months }) })),
  exportCsv: (type: CsvExportType, patientId?: string) => rawText('/reports/export/csv', withPatient(patientId, { type })),
};

// ── prescriptions ─────────────────────────────────────────────────────────
function buildPrescriptionForm(fields: PrescriptionFormFields, file?: PickedFile | null): FormData {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    form.append(key, key === 'medications' ? JSON.stringify(value) : String(value));
  });
  if (file) {
    if (Platform.OS === 'web' && file.file) {
      form.append('file', file.file, file.name);
    } else {
      // React Native's FormData accepts { uri, name, type } objects.
      form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
    }
  }
  return form;
}

export const prescriptionApi = {
  list: (patientId?: string, status?: string, archived = false) =>
    unwrap<Prescription[]>(api.get('/prescriptions', { params: withPatient(patientId, { status, archived: archived ? 'true' : undefined }) })),
  get: (id: string) => unwrap<Prescription>(api.get(`/prescriptions/${id}`)),
  history: (id: string) => unwrap<PrescriptionHistoryEntry[]>(api.get(`/prescriptions/${id}/history`)),
  parseText: (text: string) => unwrap<ParsedPrescription>(api.post('/prescriptions/parse-text', { text })),
  create: (fields: PrescriptionFormFields, file?: PickedFile | null) =>
    unwrap<Prescription>(
      api.post('/prescriptions', buildPrescriptionForm(fields, file), {
        headers: { 'Content-Type': 'multipart/form-data' },
        // The default 15s is tight for a photo upload on mobile data.
        timeout: 60000,
      }),
    ),
  update: (id: string, fields: Partial<PrescriptionFormFields> & { medications?: PrescribedMedication[] }) =>
    unwrap<Prescription>(api.put(`/prescriptions/${id}`, fields)),
  verify: (id: string, status: 'verified' | 'rejected', note?: string) => unwrap<Prescription>(api.post(`/prescriptions/${id}/verify`, { status, note })),
  parse: (id: string, text?: string) => unwrap<{ prescription: Prescription; unparsed: string[] }>(api.post(`/prescriptions/${id}/parse`, clean({ text }))),
  apply: (id: string, medicationIds?: string[]) => unwrap<{ created: Medication[]; skipped: number }>(api.post(`/prescriptions/${id}/apply`, clean({ medicationIds }))),
  archive: (id: string, restore = false) => api.delete(`/prescriptions/${id}`, { params: restore ? { restore: 'true' } : {} }).then(() => undefined),
  /** Downloads the decrypted document as a base64 data URI (works on web and native). */
  fileDataUri: async (id: string, mimeType: string | null) => {
    const res = await api.get<ArrayBuffer>(`/prescriptions/${id}/file`, { responseType: 'arraybuffer', timeout: 60000 });
    const bytes = new Uint8Array(res.data);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const b64 = typeof btoa === 'function' ? btoa(binary) : '';
    return `data:${mimeType || 'application/octet-stream'};base64,${b64}`;
  },
};

// ── AI ────────────────────────────────────────────────────────────────────
export const aiApi = {
  insights: (patientId?: string) => unwrap<AiInsights>(api.get('/ai/insights', { params: withPatient(patientId) })),
  alerts: (patientId?: string) => unwrap<AiAlert[]>(api.get('/ai/alerts', { params: withPatient(patientId) })),
  accuracy: (patientId?: string) => unwrap<AiAccuracy>(api.get('/ai/accuracy', { params: withPatient(patientId) })),
  run: (patientId?: string) => unwrap<{ created: number }>(api.post('/ai/run', undefined, { params: withPatient(patientId) })),
};
