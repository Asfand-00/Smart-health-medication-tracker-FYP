/**
 * REPORTS SERVICE — reports.service.js
 * =======================================
 * Service layer for aggregating and generating data reports for patients,
 * caregivers, and doctors, including risk analysis and PDF-ready JSON configurations.
 */

const AdherenceLog = require("../adherence/adherenceLog.model");
const Vitals = require("../vitals/vitals.model");
const CognitiveAssessment = require("../patient/cognitiveAssessment.model");
const BehavioralObservation = require("../patient/behavioralObservation.model");
const MoodTracking = require("../patient/moodTracking.model");
const RiskScore = require("../patient/riskScore.model");
const Medication = require("../medication/medication.model");
const User = require("../user/user.model");
const Patient = require("../patient/patient.model");

/**
 * Aggregates patient health reports
 */
const getAdherenceReport = async (patientUserId, { startDate, endDate }) => {
  const query = { userId: patientUserId };
  if (startDate && endDate) {
    query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const logs = await AdherenceLog.find(query).populate("medicationId", "medicineName dosage");

  const now = new Date();
  const processedLogs = logs.map(l => {
    let status = l.status;
    if (status === "pending") {
      const scheduledDate = l.scheduledTime ? new Date(l.scheduledTime) : new Date(l.date);
      if (!l.scheduledTime) {
        const expectedHours = { Morning: 8, Afternoon: 13, Evening: 18, Night: 21 };
        const expectedHour = expectedHours[l.timeOfDay] || 8;
        scheduledDate.setHours(expectedHour, 30, 0, 0);
      }
      if (scheduledDate < now) {
        status = "missed";
      }
    }
    return {
      ...l.toObject(),
      status
    };
  });

  const total = processedLogs.length;
  const taken = processedLogs.filter(l => l.status === "taken").length;
  const delayed = processedLogs.filter(l => l.status === "delayed").length;
  const missed = processedLogs.filter(l => l.status === "missed").length;
  const skipped = processedLogs.filter(l => l.status === "skipped").length;

  const adherenceRate = total > 0 ? Math.round(((taken + delayed) / total) * 100) : 100;

  return {
    totalDoses: total,
    takenDoses: taken,
    delayedDoses: delayed,
    missedDoses: missed,
    skippedDoses: skipped,
    adherenceRate,
    logs: processedLogs
  };
};

/**
 * Aggregates medication stats report
 */
const getMedicationsReport = async (patientUserId) => {
  const medications = await Medication.find({ userId: patientUserId });
  
  const activeMeds = medications.filter(m => !m.endDate || new Date(m.endDate) >= new Date()).length;
  const completedMeds = medications.filter(m => m.endDate && new Date(m.endDate) < new Date()).length;

  return {
    totalMedications: medications.length,
    activeMedications: activeMeds,
    completedMedications: completedMeds,
    medications
  };
};

/**
 * Risk analysis report
 */
const getRiskAnalysisReport = async (patientUserId) => {
  const risk = await RiskScore.findOne({ patientUserId });
  const recentAssessments = await CognitiveAssessment.find({ patientUserId })
    .sort({ assessmentDate: -1 })
    .limit(5);
  const recentObservations = await BehavioralObservation.find({ patientUserId })
    .sort({ observedAt: -1 })
    .limit(5);

  return {
    overallRisk: risk?.overallRisk || "low",
    adherenceRisk: risk?.adherenceRisk || 0,
    cognitiveRisk: risk?.cognitiveRisk || 0,
    behavioralRisk: risk?.behavioralRisk || 0,
    compositeScore: risk?.score || 0,
    factors: risk?.factors || [],
    recentAssessments,
    recentObservations
  };
};

/**
 * PDF-ready JSON document representation
 */
const getPdfReadyData = async (patientUserId) => {
  const patientUser = await User.findById(patientUserId).select("firstName lastName dateOfBirth gender");
  const patientProfile = await Patient.findOne({ userId: patientUserId });
  const adherence = await getAdherenceReport(patientUserId, { 
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days
    endDate: new Date()
  });
  const risk = await getRiskAnalysisReport(patientUserId);
  const medications = await Medication.find({ userId: patientUserId });
  const recentVitals = await Vitals.find({ patientId: patientUserId }).sort({ recordedAt: -1 }).limit(10);
  const recentMoods = await MoodTracking.find({ patientUserId }).sort({ date: -1 }).limit(10);

  return {
    reportTitle: `Comprehensive Health & Adherence Report`,
    generatedAt: new Date(),
    patientInfo: {
      fullName: `${patientUser.firstName} ${patientUser.lastName}`,
      age: patientUser.dateOfBirth ? Math.floor((Date.now() - new Date(patientUser.dateOfBirth)) / (1000 * 60 * 60 * 24 * 365.25)) : "N/A",
      gender: patientUser.gender,
      bloodGroup: patientProfile?.bloodGroup || "Unknown"
    },
    adherenceSummary: {
      adherenceRate30Days: adherence.adherenceRate,
      totalScheduled: adherence.totalDoses,
      taken: adherence.takenDoses + adherence.delayedDoses,
      missed: adherence.missedDoses,
      skipped: adherence.skippedDoses
    },
    riskAssessment: {
      overallRisk: risk.overallRisk,
      compositeScore: risk.compositeScore,
      factors: risk.factors
    },
    currentMedications: medications.map(m => ({
      name: m.medicineName,
      dosage: m.dosage,
      frequency: m.frequency,
      times: m.timeOfDay.join(", ")
    })),
    vitalsSummary: recentVitals.map(v => ({
      date: v.recordedAt,
      bp: `${v.bloodPressure?.systolic}/${v.bloodPressure?.diastolic}`,
      heartRate: v.heartRate,
      temp: v.temperature
    })),
    moodSummary: recentMoods.map(m => ({
      date: m.date,
      mood: m.mood,
      energy: m.energyLevel
    }))
  };
};

module.exports = {
  getAdherenceReport,
  getMedicationsReport,
  getRiskAnalysisReport,
  getPdfReadyData
};
