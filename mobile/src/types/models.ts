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
  | 'medication_update';
export type Priority = 'low' | 'normal' | 'high' | 'critical';

export interface AppNotification {
  _id: ObjectId;
  userId: ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  priority: Priority;
  fromUserId: UserRef | ObjectId | null;
  createdAt: ISODate;
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
