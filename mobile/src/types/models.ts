/**
 * Types for the JSON the existing Express/Mongoose backend returns.
 * Derived from backend/src/features/** models and controllers — the backend
 * exports no shared types, so these are the mobile app's contract.
 * Dates arrive as ISO strings.
 */

export type ObjectId = string;
export type ISODate = string;

export type Role = 'patient' | 'caregiver' | 'doctor' | 'admin';
export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening' | 'Night';
export const TIMES_OF_DAY: TimeOfDay[] = ['Morning', 'Afternoon', 'Evening', 'Night'];

/** Standard envelope used by every controller. */
export interface ApiEnvelope<T> {
  success: boolean;
  message?: string | string[];
  data: T;
}

/** user.model.js#getPublicProfile */
export interface User {
  _id: ObjectId;
  id: ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  phone: string | null;
  dateOfBirth: ISODate | null;
  gender: Gender | null;
  avatar: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: ISODate;
  speciality?: string;
  licenseNumber?: string;
  recoveryEmail?: string;
  privacyConsentAt?: ISODate | null;
  lastLoginAt?: ISODate | null;
  passwordChangedAt?: ISODate | null;
  assignedDoctor?: ObjectId | null;
}

/** Minimal populated user reference (`populate(..., "firstName lastName ...")`). */
export interface UserRef {
  _id: ObjectId;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string | null;
  avatar?: string | null;
  role?: Role;
  gender?: Gender | null;
  dateOfBirth?: ISODate | null;
}

export interface AuthResult {
  token: string;
  user: User;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Exclude<Role, 'admin'>;
  phone?: string;
}

export interface ProfileUpdatePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  gender?: Gender | '';
}

export interface AdminUserUpdatePayload {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  isActive: boolean;
}

/** patient.model.js */
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'Unknown';
export const BLOOD_GROUPS: BloodGroup[] = ['Unknown', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export interface PatientProfile {
  _id: ObjectId;
  userId: ObjectId;
  dateOfBirth: ISODate;
  gender: Gender;
  bloodGroup: BloodGroup;
  height: number | null;
  weight: number | null;
  medicalHistory: {
    chronicDiseases: string[];
    allergies: string[];
    pastSurgeries: string[];
    familyHistory: string[];
  };
  emergencyContact: { name: string; relation: string; phone: string };
  assignedCaregivers: ObjectId[];
  conditions?: HealthCondition[];
}

export type ConditionStatus = 'active' | 'managed' | 'resolved';
export type ConditionSeverity = 'mild' | 'moderate' | 'severe';
export interface HealthCondition {
  _id: ObjectId;
  name: string;
  status: ConditionStatus;
  severity: ConditionSeverity;
  diagnosedOn: ISODate | null;
  notes: string;
  updates: { at: ISODate; status?: ConditionStatus; severity?: ConditionSeverity; note: string }[];
  createdAt?: ISODate;
  updatedAt?: ISODate;
}
export interface HealthConditionPayload {
  name?: string;
  status?: ConditionStatus;
  severity?: ConditionSeverity;
  diagnosedOn?: string | null;
  notes?: string;
  note?: string;
}

export interface PatientProfilePayload {
  dateOfBirth: string;
  gender: Gender;
  bloodGroup: BloodGroup;
  height: number | null;
  weight: number | null;
  medicalHistory: { chronicDiseases: string[]; allergies: string[]; pastSurgeries: string[] };
  emergencyContact: { name: string; relation: string; phone: string };
}

/** medication.model.js */
export type Frequency = 'daily' | 'weekly' | 'custom';

export interface Medication {
  _id: ObjectId;
  userId: ObjectId;
  patientId: ObjectId;
  medicineName: string;
  dosage: string;
  frequency: Frequency;
  timeOfDay: TimeOfDay[];
  startDate: ISODate;
  endDate: ISODate | null;
  description: string;
  notes: string;
  createdAt: ISODate;
  prescriptionId?: ObjectId | null;
  templateId?: ObjectId | null;
  addedByRole?: Role | null;
}

export interface MedicationPayload {
  medicineName: string;
  dosage: string;
  frequency: Frequency;
  timeOfDay: TimeOfDay[];
  description: string;
  notes: string;
  startDate: string;
  endDate: string;
}

/** medicationHistory.model.js — legacy taken/missed log */
export interface MedicationHistoryEntry {
  _id: ObjectId;
  medicationId: { _id: ObjectId; medicineName: string; dosage: string } | null;
  date: ISODate;
  timeOfDay: TimeOfDay;
  status: 'taken' | 'missed';
}

export interface MedicationStats {
  today: { taken: number; missed: number; total: number; takenPercent: number };
  overall: { taken: number; missed: number; total: number; takenPercent: number };
}

/** vitals.model.js */
export interface Vitals {
  _id: ObjectId;
  patientId: ObjectId;
  bloodPressure?: { systolic?: number; diastolic?: number };
  heartRate?: number;
  bloodSugar?: number;
  weight?: number;
  temperature?: number;
  oxygenLevel?: number;
  note?: string;
  recordedAt: ISODate;
}

export interface VitalsPayload {
  bloodPressure: { systolic?: number; diastolic?: number };
  heartRate?: number;
  bloodSugar?: number;
  weight?: number;
  temperature?: number;
  oxygenLevel?: number;
  note?: string;
}

export interface TodayVitalsCheck {
  success: boolean;
  hasLoggedToday: boolean;
  data: Vitals | null;
}

/** connectionRequest.model.js */
export type RequestStatus = 'pending' | 'accepted' | 'declined';

export interface PatientSentRequest {
  _id: ObjectId;
  patientId: ObjectId;
  caregiverId: UserRef | null;
  status: RequestStatus;
}

export interface CaregiverIncomingRequest {
  _id: ObjectId;
  patientId: UserRef | null;
  caregiverId: ObjectId;
  status: RequestStatus;
}

/** GET /caregiver/patients — Patient docs with populated userId */
export interface CaregiverPatient extends Omit<PatientProfile, 'userId'> {
  userId: UserRef | null;
}

export interface PatientRecords {
  profile: PatientProfile;
  vitals: Vitals[];
  medications: Medication[];
}

/** reminder.model.js */
export type ReminderType = 'medication' | 'appointment' | 'exercise' | 'meal' | 'general' | 'poke';

export interface Reminder {
  _id: ObjectId;
  createdBy: UserRef | ObjectId | null;
  patientUserId: ObjectId;
  title: string;
  message: string;
  reminderType: ReminderType;
  medicationId:
    | (Pick<Medication, '_id' | 'medicineName' | 'dosage' | 'notes' | 'description' | 'timeOfDay'>)
    | ObjectId
    | null;
  scheduledTime: ISODate | null;
  isRead: boolean;
  createdAt: ISODate;
}

/** notification.model.js */
export type NotificationType =
  | 'reminder'
  | 'missed_dose'
  | 'escalation'
  | 'caregiver_alert'
  | 'adherence_update'
  | 'cognitive_alert'
  | 'behavioral_alert'
  | 'mood_update'
  | 'system'
  | 'connection_request'
  | 'medication_update'
  | 'ai_alert'
  | 'prescription'
  | 'plan_request'
  | 'doctor_note'
  | 'security';
export type Priority = 'low' | 'normal' | 'high' | 'critical';

export type DeliveryChannel = 'in_app' | 'email' | 'push' | 'sms' | 'voice';
export interface NotificationDelivery {
  channel: DeliveryChannel;
  status: 'sent' | 'skipped' | 'failed' | 'mock';
  detail: string;
  at: ISODate;
}

export interface AppNotification {
  _id: ObjectId;
  userId: ObjectId | UserRef;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  priority: Priority;
  fromUserId: UserRef | ObjectId | null;
  createdAt: ISODate;
  deliveries?: NotificationDelivery[];
  metadata?: Record<string, unknown>;
  relatedModel?: string | null;
  relatedId?: ObjectId | null;
  broadcastId?: string | null;
}

export interface Paginated<T> {
  total: number;
  page: number | string;
  limit: number | string;
  totalPages: number;
  notifications?: T[];
  logs?: T[];
}

export interface NotificationPage {
  notifications: AppNotification[];
  total: number;
  totalPages: number;
}

/** adherenceLog.model.js */
export type AdherenceStatus = 'pending' | 'taken' | 'missed' | 'skipped' | 'delayed' | 'overdue';

export interface AdherenceLog {
  _id: ObjectId;
  medicationId: { _id: ObjectId; medicineName: string; dosage: string } | null;
  date: ISODate;
  timeOfDay: TimeOfDay;
  status: AdherenceStatus;
  confirmedAt: ISODate | null;
  loggedBy: 'self' | 'caregiver' | 'system';
  notes: string;
}

export interface AdherenceHistoryPage {
  logs: AdherenceLog[];
  total: number;
  totalPages: number;
}

export interface ScheduleItem {
  medicationId: ObjectId;
  medicineName: string;
  dosage: string;
  timeOfDay: TimeOfDay;
  status: AdherenceStatus;
  confirmedAt: ISODate | null;
  logId: ObjectId | null;
}

export interface TodayStatus {
  schedule: ScheduleItem[];
  total: number;
  taken: number;
  missed: number;
  skipped: number;
  delayed: number;
  pending: number;
  adherencePercent: number;
}

export interface DailyAdherencePoint {
  date: string;
  dayName: string;
  taken: number;
  missed: number;
  skipped: number;
  total: number;
  adherencePercent: number;
}

export interface WeeklyReport {
  startDate: ISODate;
  endDate: ISODate;
  dailyData: DailyAdherencePoint[];
  summary: { totalDoses: number; takenDoses: number; missedDoses: number; weeklyAdherencePercent: number };
}

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface RiskFactor {
  factor: string;
  weight: number;
  description: string;
}

export interface RiskScore {
  overallRisk: RiskLevel;
  adherenceRisk: number;
  cognitiveRisk: number;
  behavioralRisk: number;
  score: number;
  factors: RiskFactor[];
}

export interface MissedDosePatterns {
  totalMissed: number;
  byTimeOfDay: Record<string, number>;
  byDayOfWeek: Record<string, number>;
  byMedication: Record<string, number>;
  mostMissedTime: string | null;
  mostMissedDay: string | null;
}

export interface PatientAdherenceBundle {
  todayStatus: TodayStatus;
  weeklyReport: WeeklyReport;
  patterns: MissedDosePatterns;
  risk: RiskScore;
}

/** Smart reminder acknowledgement */
export type AckStatus = 'taken' | 'skipped' | 'delayed';

/** caregiverDashboard.controller.js#getOverview */
export interface CaregiverOverviewPatient {
  patientId: ObjectId;
  patientProfileId: ObjectId;
  firstName: string;
  lastName: string;
  avatar: string | null;
  email: string;
  phone: string | null;
  gender: Gender | null;
  dateOfBirth: ISODate | null;
  todayAdherence: number;
  todaySchedule: ScheduleItem[];
  latestVitals: Vitals | null;
  latestCognitive: CognitiveAssessment | null;
  latestMood: MoodLog | null;
  riskScore: number;
  riskLevel: RiskLevel;
  alertsCount: number;
}

export type TimelineEventType =
  | 'adherence'
  | 'vitals'
  | 'caregiver_note'
  | 'cognitive_assessment'
  | 'behavioral_observation'
  | 'mood';

export interface TimelineEvent {
  type: TimelineEventType;
  timestamp: ISODate;
  title: string;
  message: string;
  status?: string;
  notes?: string;
}

export type NoteType = 'general' | 'medication' | 'cognitive' | 'behavioral' | 'safety' | 'daily_report';
export type NoteSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface CaregiverNote {
  _id: ObjectId;
  caregiverId: UserRef | ObjectId;
  patientUserId: ObjectId;
  title: string;
  content: string;
  noteType: NoteType;
  severity: NoteSeverity;
  createdAt: ISODate;
}

export interface CaregiverNotePayload {
  patientUserId?: ObjectId;
  title: string;
  content: string;
  noteType: NoteType;
  severity: NoteSeverity;
}

export type AssessmentType =
  | 'general'
  | 'mini_mental'
  | 'clock_drawing'
  | 'verbal_fluency'
  | 'memory_recall'
  | 'daily_check';

export interface CognitiveAssessment {
  _id: ObjectId;
  patientUserId: ObjectId;
  assessedBy: UserRef | ObjectId | null;
  assessedByRole: 'caregiver' | 'doctor';
  assessmentType: AssessmentType;
  memoryScore: number | null;
  orientationScore: number | null;
  languageScore: number | null;
  attentionScore: number | null;
  score: number;
  maxScore: number;
  observations: string;
  recommendations: string;
  assessmentDate: ISODate;
  declineFromPrevious: number | null;
}

export interface CognitiveAssessmentPayload {
  patientUserId: ObjectId;
  assessmentType: AssessmentType;
  memoryScore: number;
  orientationScore: number;
  languageScore: number;
  attentionScore: number;
  score: number;
  maxScore: number;
  observations: string;
  recommendations: string;
}

export type ObservationType =
  | 'confusion'
  | 'wandering'
  | 'agitation'
  | 'mood_change'
  | 'medication_confusion'
  | 'sleep_disturbance'
  | 'safety_concern';
export type ObservationSeverity = 'mild' | 'moderate' | 'severe' | 'critical';

export interface BehavioralObservationPayload {
  patientUserId: ObjectId;
  observationType: ObservationType;
  description: string;
  severity: ObservationSeverity;
  actionsTaken: string;
}

export interface BehavioralObservation {
  _id: ObjectId;
  observationType: ObservationType;
  description: string;
  severity: ObservationSeverity;
  observedAt: ISODate;
}

export type Mood = 'happy' | 'calm' | 'anxious' | 'confused' | 'agitated' | 'sad' | 'frustrated' | 'other';

export interface MoodLog {
  _id: ObjectId;
  patientUserId: ObjectId;
  mood: Mood;
  energyLevel: number;
  notes: string;
  loggedBy: 'self' | 'caregiver';
  date: ISODate;
}

export interface MoodPayload {
  patientUserId: ObjectId;
  mood: Mood;
  energyLevel: number;
  notes: string;
}

export interface EmergencyContact {
  _id: ObjectId;
  patientUserId: ObjectId;
  name: string;
  relation: string;
  phone: string;
  email: string;
  isPrimary: boolean;
  canReceiveAlerts: boolean;
}

export interface EmergencyContactPayload {
  patientUserId: ObjectId;
  name: string;
  relation: string;
  phone: string;
  email: string;
  isPrimary?: boolean;
  canReceiveAlerts?: boolean;
}

/** reports.service.js */
export interface AdherenceReport {
  totalDoses: number;
  takenDoses: number;
  delayedDoses: number;
  missedDoses: number;
  skippedDoses: number;
  adherenceRate: number;
  logs: AdherenceLog[];
}

export interface MedicationsReport {
  totalMedications: number;
  activeMedications: number;
  completedMedications: number;
  medications: Medication[];
}

export interface RiskAnalysisReport {
  overallRisk: RiskLevel;
  adherenceRisk: number;
  cognitiveRisk: number;
  behavioralRisk: number;
  compositeScore: number;
  factors: RiskFactor[];
  recentAssessments: CognitiveAssessment[];
  recentObservations: BehavioralObservation[];
}

export interface PdfReadyReport {
  reportTitle: string;
  generatedAt: ISODate;
  patientInfo: { fullName: string; age: number | string; gender: string | null; bloodGroup: string };
  adherenceSummary: {
    adherenceRate30Days: number;
    totalScheduled: number;
    taken: number;
    missed: number;
    skipped: number;
  };
  riskAssessment: { overallRisk: RiskLevel; compositeScore: number; factors: RiskFactor[] };
  currentMedications: { name: string; dosage: string; frequency: string; times: string }[];
  vitalsSummary: { date: ISODate; bp: string; heartRate?: number; temp?: number }[];
  moodSummary: { date: ISODate; mood: Mood; energy: number }[];
}

/** Admin: GET /user/all returns full user docs (minus secrets). */
export type AdminUser = User;

// ═══════════════════════════════════════════════════════════════════════
// Types for the modules added to the backend (auth recovery, doctor,
// prescriptions, plan approval, templates, calendar, drug info, AI,
// analytics, notification settings, audit, admin).
// ═══════════════════════════════════════════════════════════════════════

export interface ForgotPasswordResult {
  expiresInMinutes: number;
  /** Only present when the backend runs in development without SMTP. */
  devCode?: string;
}

export interface ReminderPreferences {
  reminderTimes: Record<TimeOfDay, string>;
  reminderLeadMinutes: number;
  voiceAlerts: boolean;
  effective: Record<TimeOfDay, { hour: number; minute: number }>;
}

export interface AdaptiveSuggestion {
  timeOfDay: TimeOfDay;
  avgDelayMinutes: number;
  currentScheduledTime: string;
  suggestedTime: string;
  reason: string;
}

export interface NotificationSettings {
  _id: ObjectId;
  userId: ObjectId;
  channels: { inApp: boolean; email: boolean; push: boolean; sms: boolean };
  types: Record<NotificationType, boolean>;
  quietHours: { enabled: boolean; start: string; end: string };
  reminderTimes: Record<TimeOfDay, string>;
  reminderLeadMinutes: number;
  voiceAlerts: boolean;
  smsPhone: string;
  dailySummaryEmail: boolean;
}
export type NotificationSettingsPayload = Partial<{
  channels: Partial<NotificationSettings['channels']>;
  types: Partial<NotificationSettings['types']>;
  quietHours: Partial<NotificationSettings['quietHours']>;
  reminderTimes: Partial<NotificationSettings['reminderTimes']>;
  reminderLeadMinutes: number;
  voiceAlerts: boolean;
  smsPhone: string;
  dailySummaryEmail: boolean;
}>;

export interface PushTokenInfo {
  _id: ObjectId;
  token: string;
  platform: 'ios' | 'android' | 'web' | 'unknown';
  deviceName: string;
  lastSeenAt: ISODate;
}

/** doctor.controller.js */
export interface DoctorRef extends UserRef {
  speciality?: string;
  licenseNumber?: string;
}
export interface DoctorPatientLink {
  _id: ObjectId;
  doctorId: DoctorRef | ObjectId;
  patientUserId: UserRef | ObjectId;
  status: 'pending' | 'accepted' | 'declined' | 'ended';
  requestedBy: 'patient' | 'doctor';
  message: string;
  respondedAt: ISODate | null;
  createdAt: ISODate;
}
export interface DoctorPatientRow {
  linkId: ObjectId;
  patientId: ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  dateOfBirth: ISODate | null;
  gender: Gender | null;
  linkedAt: ISODate;
  todayAdherence: number;
  weeklyAdherence: number;
  riskLevel: RiskLevel;
  riskScore: number;
  medicationCount: number;
  pendingPrescriptions: number;
}
export interface DoctorDashboard {
  totalPatients: number;
  pendingRequests: number;
  pendingPrescriptions: number;
  pendingPlanApprovals: number;
  averageWeeklyAdherence: number;
  highRiskPatients: { patientId: ObjectId; name: string; risk: RiskLevel; score: number }[];
  unreadAlerts: number;
  recentNotes: DoctorNote[];
}
export type DoctorNoteType = 'prescription' | 'observation' | 'assessment' | 'recommendation' | 'follow_up';
export interface DoctorNote {
  _id: ObjectId;
  doctorId: DoctorRef | ObjectId;
  patientUserId: UserRef | ObjectId;
  noteType: DoctorNoteType;
  title: string;
  content: string;
  isConfidential: boolean;
  diagnosis: string;
  followUpDate: ISODate | null;
  createdAt: ISODate;
}
export interface DoctorNotePayload {
  patientUserId?: ObjectId;
  title: string;
  content: string;
  noteType: DoctorNoteType;
  diagnosis?: string;
  followUpDate?: string | null;
  isConfidential?: boolean;
}
export interface DoctorPatientOverview {
  user: UserRef;
  profile: PatientProfile | null;
  medications: Medication[];
  today: TodayStatus;
  weekly: WeeklyReport;
  patterns: MissedDosePatterns;
  risk: RiskScore;
  vitals: Vitals[];
  prescriptions: Prescription[];
  moods: MoodLog[];
  cognitive: CognitiveAssessment[];
  notes: DoctorNote[];
}

/** prescription.model.js */
export type PrescriptionStatus = 'pending' | 'verified' | 'rejected' | 'expired';
export interface PrescribedMedication {
  _id?: ObjectId;
  medicineName: string;
  dosage: string;
  frequency: Frequency;
  timeOfDay: TimeOfDay[];
  durationDays: number | null;
  instructions: string;
  sourceLine?: string;
  confidence?: number;
}
export interface PrescriptionHistoryEntry {
  action: string;
  at: ISODate;
  note: string;
  byRole: string | null;
  by: { firstName: string; lastName: string; role: Role } | null;
}
export interface Prescription {
  _id: ObjectId;
  patientUserId: UserRef | ObjectId;
  uploadedBy: UserRef | ObjectId;
  uploadedByRole: Role;
  doctorId: ObjectId | null;
  doctorName: string;
  title: string;
  issuedDate: ISODate;
  expiryDate: ISODate | null;
  diagnosis: string;
  notes: string;
  rawText: string;
  medications: PrescribedMedication[];
  file: { originalName: string | null; mimeType: string | null; size: number | null; checksum: string | null; encrypted: boolean };
  status: PrescriptionStatus;
  verifiedBy: UserRef | ObjectId | null;
  verifiedAt: ISODate | null;
  verificationNote: string;
  appliedAt: ISODate | null;
  appliedMedicationIds: ObjectId[];
  isArchived: boolean;
  createdAt: ISODate;
}
export interface ParsedPrescription {
  medications: PrescribedMedication[];
  unparsed: string[];
  parsedLines: number;
  totalLines: number;
}
export interface PrescriptionFormFields {
  patientUserId?: ObjectId;
  title: string;
  doctorName?: string;
  issuedDate?: string;
  expiryDate?: string;
  diagnosis?: string;
  notes?: string;
  rawText?: string;
  medications?: PrescribedMedication[];
}
export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  /** Set on web where the picker gives a File object. */
  file?: Blob;
}

/** medicationPlanRequest.model.js */
export type PlanRequestType = 'add' | 'update' | 'stop';
export type PlanRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export interface PlanProposal {
  medicineName?: string;
  dosage?: string;
  frequency?: Frequency;
  timeOfDay?: TimeOfDay[];
  startDate?: string | ISODate;
  endDate?: string | ISODate | null;
  description?: string;
  notes?: string;
}
export interface MedicationPlanRequest {
  _id: ObjectId;
  patientUserId: UserRef | ObjectId;
  requestedBy: UserRef | ObjectId;
  requestedByRole: 'patient' | 'caregiver';
  reviewerId: UserRef | ObjectId;
  reviewerRole: 'caregiver' | 'doctor';
  type: PlanRequestType;
  medicationId: ObjectId | null;
  medicationSnapshot: PlanProposal | null;
  proposed: PlanProposal | null;
  reason: string;
  status: PlanRequestStatus;
  reviewNote: string;
  reviewedAt: ISODate | null;
  createdAt: ISODate;
}
export interface PlanRequestPayload {
  type: PlanRequestType;
  reviewerId: ObjectId;
  medicationId?: ObjectId;
  proposed?: PlanProposal;
  reason?: string;
  patientUserId?: ObjectId;
}

/** medicationTemplate.model.js */
export interface TemplateItem {
  _id?: ObjectId;
  medicineName: string;
  dosage: string;
  frequency: Frequency;
  timeOfDay: TimeOfDay[];
  durationDays: number | null;
  notes: string;
}
export interface MedicationTemplate {
  _id: ObjectId;
  name: string;
  description: string;
  category: string;
  items: TemplateItem[];
  isGlobal: boolean;
  createdBy: ObjectId | null;
  usageCount: number;
}


/** medicationCalendar.service.js */
export type CalendarItemStatus = 'scheduled' | 'taken' | 'missed' | 'skipped' | 'delayed';
export interface CalendarItem {
  medicationId: ObjectId;
  medicineName: string;
  dosage: string;
  timeOfDay: TimeOfDay;
  status: CalendarItemStatus;
  confirmedAt: ISODate | null;
}
export interface CalendarDay {
  date: string;
  isToday: boolean;
  isPast: boolean;
  total: number;
  scheduled: number;
  taken: number;
  missed: number;
  skipped: number;
  delayed: number;
  adherencePercent: number | null;
  summary: 'none' | 'upcoming' | 'complete' | 'partial' | 'missed' | 'pending';
  items: CalendarItem[];
}
export interface CalendarMonth {
  month: string;
  startDate: ISODate;
  endDate: ISODate;
  medications: Pick<Medication, '_id' | 'medicineName' | 'dosage' | 'timeOfDay' | 'startDate' | 'endDate' | 'frequency'>[];
  summary: { scheduled: number; taken: number; missed: number; adherencePercent: number };
  days: CalendarDay[];
}

/** drugInfo.service.js */
export interface DrugSummary {
  name: string;
  class: string;
  uses: string;
}
export interface DrugInfo extends DrugSummary {
  aliases: string[];
  sideEffects: string[];
  warnings: string;
  interactions: string[];
  foodAdvice: string;
}
export interface InteractionCheck {
  checked: number;
  recognised: string[];
  unrecognised: string[];
  warnings: { medications: string[]; severity: 'moderate' | 'high'; message: string }[];
}

/** ai.service.js */
export interface AiPrediction {
  medicationId: ObjectId;
  medicineName: string;
  dosage: string;
  timeOfDay: TimeOfDay;
  nextDue: ISODate;
  nextDueDate: string;
  probability: number;
  riskLevel: RiskLevel;
  sampleSize: number;
  reasons: string[];
}
export interface AiInsightText {
  severity: 'low' | 'moderate' | 'high';
  title: string;
  detail: string;
}
export interface AiRiskFlag {
  code: string;
  severity: RiskLevel;
  title: string;
  detail: string;
  recommendation: string;
}
export interface AiRecommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  action: { type: string; timeOfDay?: TimeOfDay; suggestedTime?: string; currentTime?: string; medicationId?: ObjectId };
}
export interface AiInsights {
  generatedAt: ISODate;
  enabled: boolean;
  lookbackDays: number;
  summary: {
    riskLevel: RiskLevel;
    riskScore: number;
    adherenceRate: number | null;
    trend: 'improving' | 'declining' | 'stable';
    highestMissProbability: number;
    flagsCount: number;
    headline: string;
  };
  predictions: {
    predictions: AiPrediction[];
    overall: { baseMissRate: number; recentMissRate: number | null; trend: string; sampleSize: number; lookbackDays: number };
  };
  behavior: {
    sampleSize: number;
    takenCount: number;
    missedCount: number;
    delayedCount: number;
    adherenceRate: number | null;
    consistencyScore: number | null;
    currentStreak: number;
    longestStreak: number;
    avgResponseMinutes: number | null;
    byWeekday: { day: string; total: number; missed: number; missRate: number | null }[];
    bySlot: { slot: TimeOfDay; total: number; missed: number; missRate: number | null }[];
    weekendEffect: { weekendMissRate: number | null; weekdayMissRate: number | null };
    moodCorrelation: { badMoodMissRate: number | null; otherMissRate: number | null; badMoodDays: number };
    insights: AiInsightText[];
  };
  risks: { flags: AiRiskFlag[]; score: number; level: RiskLevel };
  recommendations: AiRecommendation[];
}
export interface AiAlert {
  _id: ObjectId;
  kind: 'missed_dose_prediction' | 'risk_flag';
  code: string;
  medicineName: string;
  timeOfDay: TimeOfDay | null;
  date: string;
  probability: number | null;
  severity: RiskLevel;
  title: string;
  message: string;
  recommendation: string;
  notifiedPatient: boolean;
  notifiedCareCircle: boolean;
  outcome: 'pending' | 'taken' | 'missed' | 'skipped' | 'n/a';
  createdAt: ISODate;
}
export interface AiAccuracy {
  predictions: number;
  confirmedMisses: number;
  precision: number | null;
}

/** analytics.service.js */
export interface TrendInfo {
  direction: 'rising' | 'falling' | 'stable' | 'insufficient';
  slopePerDay: number | null;
}
export interface MetricStats {
  min: number | null;
  max: number | null;
  avg: number | null;
  latest: number | null;
  count: number;
}
export interface VitalSeries {
  label: string;
  unit: string;
  low: number | null;
  high: number | null;
  points: { date: ISODate; value: number }[];
  stats: MetricStats;
  trend: TrendInfo;
  outOfRange: number;
}
export type VitalKey = 'systolic' | 'diastolic' | 'heartRate' | 'bloodSugar' | 'temperature' | 'oxygenLevel' | 'weight';
export interface HealthTrends {
  days: number;
  since: ISODate;
  vitals: Record<VitalKey, VitalSeries>;
  adherence: { series: { date: string; taken: number; total: number; percent: number | null }[]; trend: TrendInfo; weeklyPercent: number };
  mood: { series: { date: ISODate; mood: Mood; score: number; energy: number }[]; stats: MetricStats; trend: TrendInfo };
  cognitive: { series: { date: ISODate; score: number; maxScore: number; percent: number; type: string }[]; trend: TrendInfo };
}
export interface AnalyticsInsights {
  days: number;
  insights: AiInsightText[];
  generatedAt: ISODate;
}
export interface PerformanceReport {
  months: number;
  monthly: {
    month: string;
    startDate: ISODate;
    totalDoses: number;
    takenDoses: number;
    missedDoses: number;
    adherencePercent: number;
    weeks: { week: number; startDate: string; taken: number; missed: number; total: number; adherencePercent: number }[];
  }[];
  bestWeek: { week: number; startDate: string; adherencePercent: number; month: string } | null;
  worstWeek: { week: number; startDate: string; adherencePercent: number; month: string } | null;
  monthOverMonthChange: number | null;
  trend: TrendInfo;
}
export type CsvExportType = 'vitals' | 'medications' | 'mood' | 'full';

/** auditLog.model.js */
export interface AuditLogEntry {
  _id: ObjectId;
  userId: UserRef | null;
  userRole: string | null;
  action: string;
  category: string;
  status: 'success' | 'failure' | 'denied';
  method: string | null;
  path: string | null;
  statusCode: number | null;
  ip: string | null;
  details: string;
  targetUserId: UserRef | null;
  createdAt: ISODate;
}
export interface AuditPage {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
export interface AuditStats {
  days: number;
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  failedLogins: number;
}

/** admin.controller.js */
export interface AdminDashboard {
  users: { total: number; inactive: number; newThisWeek: number; activeToday: number; byRole: Record<string, number> };
  activity: {
    dosesToday: number;
    takenToday: number;
    missedToday: number;
    medications: number;
    adherenceLogs: number;
    prescriptionsPending: number;
    highRiskPatients: number;
    aiAlerts24h: number;
  };
  notifications: { last24h: number; failedDeliveries24h: number; pushDevices: number };
  security: { failedLogins24h: number; deniedRequests24h: number; maintenanceMode: boolean; allowRegistration: boolean };
  system: {
    status: string;
    uptimeSeconds: number;
    startedAt: ISODate;
    nodeVersion: string;
    platform: string;
    environment: string;
    memory: { rssMb: number; heapUsedMb: number; heapTotalMb: number };
    cpuLoad: number[];
    database: { state: string; host?: string; name?: string; collections?: number; objects?: number; dataSizeMb?: number; storageSizeMb?: number };
    socketConnections: number;
    scheduler: Record<string, unknown>;
    channels: { email: boolean; sms: boolean; push: boolean };
  };
}
export interface AdminUsersPage {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
export interface AdminUserDetail {
  user: User;
  activity: AuditLogEntry[];
  notifications: number;
  profile: Partial<PatientProfile> | null;
  medications: number;
  pushDevices: number;
}
export interface AdminCreateUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Role;
  phone?: string;
  speciality?: string;
}
export interface BroadcastPayload {
  title: string;
  message: string;
  roles?: Role[];
  userIds?: ObjectId[];
  priority?: Priority;
  channel?: 'in_app' | 'email' | 'both' | 'all';
}
export interface AdminNotificationsPage {
  notifications: AppNotification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  byType: Record<string, number>;
}
export interface AdminAlerts {
  critical: AppNotification[];
  escalationsThisWeek: number;
  aiAlerts: (AiAlert & { patientUserId: UserRef | ObjectId })[];
  highRiskPatients: { _id: ObjectId; patientUserId: UserRef | ObjectId; overallRisk: RiskLevel; score: number }[];
}
export interface AdminReportsOverview {
  months: number;
  userGrowth: ({ month: string; total: number } & Partial<Record<Role, number>>)[];
  adherenceByMonth: { month: string; total: number; taken: number; percent: number }[];
  notificationsByMonth: { month: string; count: number }[];
  usersByRole: Record<string, number>;
  platformAdherencePercent: number;
  totalDosesLogged: number;
  riskDistribution: Record<string, number>;
  prescriptionsByStatus: Record<string, number>;
  topMedications: { name: string; count: number }[];
}
export interface SystemConfig {
  appName: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowRegistration: boolean;
  registrationRoles: string[];
  reminderTimes: Record<TimeOfDay, string>;
  gracePeriodMinutes: number;
  escalation: { level2Minutes: number; level3Minutes: number };
  ai: { enabled: boolean; alertThreshold: number; caregiverAlertThreshold: number; lookbackDays: number };
  channels: { emailEnabled: boolean; smsEnabled: boolean; pushEnabled: boolean };
  security: {
    maxLoginAttempts: number;
    lockoutMinutes: number;
    passwordMinLength: number;
    passwordRequireNumber: boolean;
    sessionDays: number;
    otpExpiryMinutes: number;
  };
  prescriptions: { maxFileSizeMb: number; requireDoctorVerification: boolean };
  updatedAt?: ISODate;
}
export type SystemConfigPayload = Partial<Omit<SystemConfig, 'updatedAt'>>;
