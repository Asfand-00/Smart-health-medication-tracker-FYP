/**
 * CAREGIVER DASHBOARD CONTROLLER — caregiverDashboard.controller.js
 * ==================================================================
 * Handles requests for the comprehensive caregiver dashboard:
 * Patient timeline, notes, cognitive assessments, behavioral observations,
 * emergency contacts, and active alerts.
 */

const Patient = require("../patient/patient.model");
const User = require("../user/user.model");
const AdherenceLog = require("../adherence/adherenceLog.model");
const Vitals = require("../vitals/vitals.model");
const CaregiverNote = require("./caregiverNote.model");
const CognitiveAssessment = require("../patient/cognitiveAssessment.model");
const BehavioralObservation = require("../patient/behavioralObservation.model");
const MoodTracking = require("../patient/moodTracking.model");
const EmergencyContact = require("../patient/emergencyContact.model");
const Notification = require("../notification/notification.model");
const adherenceService = require("../adherence/adherence.service");
const notificationService = require("../notification/notification.service");

// Helper: verify caregiver is assigned to this patient
const verifyCaregiverAssignment = async (caregiverId, patientUserId) => {
  const patientProfile = await Patient.findOne({ userId: patientUserId, assignedCaregivers: caregiverId });
  if (!patientProfile) {
    throw { status: 403, message: "Not authorized to view or manage this patient." };
  }
  return patientProfile;
};

// GET /api/caregiver-dashboard/overview — Full dashboard summary of all patients
exports.getOverview = async (req, res, next) => {
  try {
    const caregiverId = req.user._id;

    // Find patients assigned to this caregiver
    const patients = await Patient.find({ assignedCaregivers: caregiverId })
      .populate("userId", "firstName lastName avatar email phone gender dateOfBirth");

    const overviewData = [];

    for (const patient of patients) {
      if (!patient.userId) {
        console.warn(`⚠️ Patient document ${patient._id} has no populated userId. Skipping.`);
        continue;
      }
      const patientUserId = patient.userId._id;

      // 1. Get today's adherence
      const todayAdherence = await adherenceService.getTodayStatus(patientUserId);

      // 2. Get latest vitals
      const latestVitals = await Vitals.findOne({ patientId: patientUserId })
        .sort({ recordedAt: -1 });

      // 3. Get latest cognitive assessment
      const latestCognitive = await CognitiveAssessment.findOne({ patientUserId })
        .sort({ assessmentDate: -1 });

      // 4. Get latest mood
      const latestMood = await MoodTracking.findOne({ patientUserId })
        .sort({ date: -1 });

      // 5. Get current risk score
      const riskScore = await adherenceService.calculateRiskScore(patientUserId);

      // 6. Get active alerts count (unread high/critical notifications)
      const alertsCount = await Notification.countDocuments({
        userId: caregiverId,
        fromUserId: patientUserId,
        isRead: false,
        priority: { $in: ["high", "critical"] }
      });

      overviewData.push({
        patientId: patientUserId,
        patientProfileId: patient._id,
        firstName: patient.userId.firstName,
        lastName: patient.userId.lastName,
        avatar: patient.userId.avatar,
        email: patient.userId.email,
        phone: patient.userId.phone,
        gender: patient.userId.gender,
        dateOfBirth: patient.userId.dateOfBirth,
        todayAdherence: todayAdherence.adherencePercent,
        todaySchedule: todayAdherence.schedule,
        latestVitals,
        latestCognitive,
        latestMood,
        riskScore: riskScore.score,
        riskLevel: riskScore.overallRisk,
        alertsCount
      });
    }

    res.status(200).json({ success: true, data: overviewData });
  } catch (error) {
    next(error);
  }
};

// GET /api/caregiver-dashboard/patients/:id/timeline — Patient activity timeline
exports.getPatientTimeline = async (req, res, next) => {
  try {
    const patientUserId = req.params.id;
    const caregiverId = req.user._id;
    await verifyCaregiverAssignment(caregiverId, patientUserId);

    // Fetch past 14 days of events
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 14);

    const adherenceLogs = await AdherenceLog.find({ userId: patientUserId, date: { $gte: startDate } })
      .populate("medicationId", "medicineName dosage");

    const vitalsLogs = await Vitals.find({ patientId: patientUserId, recordedAt: { $gte: startDate } });

    const notes = await CaregiverNote.find({ patientUserId, createdAt: { $gte: startDate } })
      .populate("caregiverId", "firstName lastName");

    const assessments = await CognitiveAssessment.find({ patientUserId, assessmentDate: { $gte: startDate } })
      .populate("assessedBy", "firstName lastName");

    const observations = await BehavioralObservation.find({ patientUserId, observedAt: { $gte: startDate } })
      .populate("observedBy", "firstName lastName");

    const moodLogs = await MoodTracking.find({ patientUserId, date: { $gte: startDate } });

    // Combine all logs into a single chronologically sorted list
    const timeline = [];

    adherenceLogs.forEach((log) => {
      timeline.push({
        type: "adherence",
        timestamp: log.confirmedAt || log.createdAt || log.date,
        title: `Dose ${log.status === "taken" ? "taken" : log.status === "delayed" ? "taken delayed" : log.status}`,
        message: `${log.timeOfDay} dose of ${log.medicationId?.medicineName || "medication"} (${log.medicationId?.dosage || ""})`,
        status: log.status,
        notes: log.notes,
        metadata: { medicationId: log.medicationId?._id }
      });
    });

    vitalsLogs.forEach((log) => {
      timeline.push({
        type: "vitals",
        timestamp: log.recordedAt,
        title: "Vitals Recorded",
        message: `BP: ${log.bloodPressure?.systolic}/${log.bloodPressure?.diastolic} mmHg, Heart Rate: ${log.heartRate} bpm, Temp: ${log.temperature}°C`,
        status: log.status || "normal",
        notes: log.notes,
        metadata: log
      });
    });

    notes.forEach((log) => {
      timeline.push({
        type: "caregiver_note",
        timestamp: log.createdAt,
        title: `Caregiver Note: ${log.title}`,
        message: log.content,
        status: log.severity,
        notes: `Written by ${log.caregiverId?.firstName} ${log.caregiverId?.lastName}`,
        metadata: { noteId: log._id, tags: log.tags }
      });
    });

    assessments.forEach((log) => {
      timeline.push({
        type: "cognitive_assessment",
        timestamp: log.assessmentDate,
        title: `Cognitive Assessment logged`,
        message: `Score: ${log.score}/${log.maxScore} (${log.assessmentType}). Observations: ${log.observations}`,
        status: log.score < 20 ? "severe" : log.score < 30 ? "moderate" : "mild",
        notes: `Assessed by ${log.assessedBy?.firstName} ${log.assessedBy?.lastName}`,
        metadata: log
      });
    });

    observations.forEach((log) => {
      timeline.push({
        type: "behavioral_observation",
        timestamp: log.observedAt,
        title: `Behavioral Observation: ${log.observationType}`,
        message: log.description,
        status: log.severity,
        notes: `Observed by ${log.observedBy?.firstName} ${log.observedBy?.lastName}. Actions: ${log.actionsTaken}`,
        metadata: log
      });
    });

    moodLogs.forEach((log) => {
      timeline.push({
        type: "mood",
        timestamp: log.date,
        title: `Mood update: ${log.mood}`,
        message: `Energy level: ${log.energyLevel}/5. Notes: ${log.notes || "None"}`,
        status: log.mood === "agitated" || log.mood === "anxious" || log.mood === "confused" ? "warning" : "success",
        notes: `Logged by ${log.loggedBy}`,
        metadata: log
      });
    });

    // Sort descending by timestamp
    timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.status(200).json({ success: true, data: timeline });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/caregiver-dashboard/patients/:id/adherence — Patient adherence analytics
exports.getPatientAdherence = async (req, res, next) => {
  try {
    const patientUserId = req.params.id;
    const caregiverId = req.user._id;
    await verifyCaregiverAssignment(caregiverId, patientUserId);

    const todayStatus = await adherenceService.getTodayStatus(patientUserId);
    const weeklyReport = await adherenceService.getWeeklyReport(patientUserId);
    const patterns = await adherenceService.getMissedDosePatterns(patientUserId);
    const risk = await adherenceService.calculateRiskScore(patientUserId);

    res.status(200).json({
      success: true,
      data: {
        todayStatus,
        weeklyReport,
        patterns,
        risk
      }
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// POST /api/caregiver-dashboard/notes — Add caregiver note
exports.addCaregiverNote = async (req, res, next) => {
  try {
    const caregiverId = req.user._id;
    const { patientUserId, title, content, noteType, severity, tags, isPrivate } = req.body;

    if (!patientUserId || !title || !content) {
      return res.status(400).json({ success: false, message: "patientUserId, title, and content are required." });
    }

    await verifyCaregiverAssignment(caregiverId, patientUserId);

    const note = await CaregiverNote.create({
      caregiverId,
      patientUserId,
      title,
      content,
      noteType: noteType || "general",
      severity: severity || "low",
      tags: tags || [],
      isPrivate: isPrivate || false
    });

    res.status(201).json({ success: true, message: "Caregiver note added successfully", data: note });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/caregiver-dashboard/notes/:patientId — Get notes for patient
exports.getCaregiverNotes = async (req, res, next) => {
  try {
    const caregiverId = req.user._id;
    const patientUserId = req.params.patientId;
    await verifyCaregiverAssignment(caregiverId, patientUserId);

    const notes = await CaregiverNote.find({ patientUserId })
      .populate("caregiverId", "firstName lastName")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: notes });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// PUT /api/caregiver-dashboard/notes/:id — Update note
exports.updateCaregiverNote = async (req, res, next) => {
  try {
    const caregiverId = req.user._id;
    const noteId = req.params.id;
    const { title, content, noteType, severity, tags, isPrivate } = req.body;

    const note = await CaregiverNote.findOne({ _id: noteId, caregiverId });
    if (!note) {
      return res.status(404).json({ success: false, message: "Note not found or unauthorized." });
    }

    note.title = title || note.title;
    note.content = content || note.content;
    note.noteType = noteType || note.noteType;
    note.severity = severity || note.severity;
    note.tags = tags || note.tags;
    note.isPrivate = isPrivate !== undefined ? isPrivate : note.isPrivate;

    await note.save();

    res.status(200).json({ success: true, message: "Caregiver note updated successfully", data: note });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/caregiver-dashboard/notes/:id — Delete note
exports.deleteCaregiverNote = async (req, res, next) => {
  try {
    const caregiverId = req.user._id;
    const noteId = req.params.id;

    const result = await CaregiverNote.deleteOne({ _id: noteId, caregiverId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Note not found or unauthorized." });
    }

    res.status(200).json({ success: true, message: "Caregiver note deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// POST /api/caregiver-dashboard/cognitive-assessment — Log cognitive assessment
exports.logCognitiveAssessment = async (req, res, next) => {
  try {
    const assessorId = req.user._id;
    const role = req.user.role; // caregiver or doctor
    const { patientUserId, assessmentType, memoryScore, orientationScore, languageScore, attentionScore, score, maxScore, observations, recommendations } = req.body;

    if (!patientUserId) {
      return res.status(400).json({ success: false, message: "patientUserId is required." });
    }

    if (role === "caregiver") {
      await verifyCaregiverAssignment(assessorId, patientUserId);
    }

    // Find previous assessment to track decline
    const prev = await CognitiveAssessment.findOne({ patientUserId })
      .sort({ assessmentDate: -1 });

    const calculatedScore = score !== undefined ? score : (Number(memoryScore || 0) + Number(orientationScore || 0) + Number(languageScore || 0) + Number(attentionScore || 0));
    const calculatedMax = maxScore || 40;

    let decline = null;
    if (prev && prev.score) {
      decline = Math.round(((prev.score - calculatedScore) / prev.score) * 100);
    }

    const assessment = await CognitiveAssessment.create({
      patientUserId,
      assessedBy: assessorId,
      assessedByRole: role,
      assessmentType: assessmentType || "general",
      memoryScore,
      orientationScore,
      languageScore,
      attentionScore,
      score: calculatedScore,
      maxScore: calculatedMax,
      observations: observations || "",
      recommendations: recommendations || "",
      declineFromPrevious: decline
    });

    // Alert caregiver/doctor in real-time if decline is high (> 20%)
    if (decline >= 20) {
      const io = req.app.locals.io;
      const patientUser = await User.findById(patientUserId).select("firstName lastName");
      
      // If doctor did assessment, notify caregivers
      if (role === "doctor") {
        const patientProfile = await Patient.findOne({ userId: patientUserId });
        if (patientProfile?.assignedCaregivers) {
          for (const cgId of patientProfile.assignedCaregivers) {
            if (io) {
              io.to(cgId.toString()).emit("cognitive_alert", {
                patientId: patientUserId,
                patientName: `${patientUser.firstName} ${patientUser.lastName}`,
                declinePercent: decline,
                score: calculatedScore,
                observations
              });
            }

            await notificationService.createNotification({
              userId: cgId,
              type: "cognitive_alert",
              title: `⚠️ Significant Cognitive Decline in ${patientUser.firstName}`,
              message: `${patientUser.firstName}'s cognitive score declined by ${decline}% in the recent assessment (${calculatedScore}/${calculatedMax}).`,
              priority: "high",
              channel: "both",
              fromUserId: patientUserId,
              relatedModel: "CognitiveAssessment",
              relatedId: assessment._id,
              io
            });
          }
        }
      }
    }

    res.status(201).json({ success: true, message: "Cognitive assessment logged successfully", data: assessment });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/caregiver-dashboard/cognitive-assessments/:patientId — Get assessments
exports.getCognitiveAssessments = async (req, res, next) => {
  try {
    const patientUserId = req.params.patientId;
    const caregiverId = req.user._id;
    if (req.user.role === "caregiver") {
      await verifyCaregiverAssignment(caregiverId, patientUserId);
    }

    const assessments = await CognitiveAssessment.find({ patientUserId })
      .populate("assessedBy", "firstName lastName role")
      .sort({ assessmentDate: -1 });

    res.status(200).json({ success: true, data: assessments });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// POST /api/caregiver-dashboard/behavioral-observation — Log behavioral observation
exports.logBehavioralObservation = async (req, res, next) => {
  try {
    const observerId = req.user._id;
    const { patientUserId, observationType, description, severity, location, duration, triggers, actionsTaken, requiresFollowUp, followUpNotes } = req.body;

    if (!patientUserId || !observationType || !description) {
      return res.status(400).json({ success: false, message: "patientUserId, observationType, and description are required." });
    }

    await verifyCaregiverAssignment(observerId, patientUserId);

    const observation = await BehavioralObservation.create({
      patientUserId,
      observedBy: observerId,
      observationType,
      description,
      severity: severity || "mild",
      location: location || "",
      duration: duration || null,
      triggers: triggers || [],
      actionsTaken: actionsTaken || "",
      requiresFollowUp: requiresFollowUp || false,
      followUpNotes: followUpNotes || ""
    });

    // Alert if severity is critical
    if (severity === "critical") {
      const io = req.app.locals.io;
      const patientUser = await User.findById(patientUserId).select("firstName lastName");
      
      // Notify caregiver self + doctor or other connected caregivers
      const patientProfile = await Patient.findOne({ userId: patientUserId });
      if (patientProfile?.assignedCaregivers) {
        for (const cgId of patientProfile.assignedCaregivers) {
          if (cgId.toString() !== observerId.toString()) {
            if (io) {
              io.to(cgId.toString()).emit("behavioral_alert", {
                patientId: patientUserId,
                patientName: `${patientUser.firstName} ${patientUser.lastName}`,
                observationType,
                severity
              });
            }

            await notificationService.createNotification({
              userId: cgId,
              type: "behavioral_alert",
              title: `🚨 Critical Behavioral Alert: ${patientUser.firstName}`,
              message: `${patientUser.firstName} showed critical ${observationType.replace('_', ' ')}. Description: ${description}`,
              priority: "critical",
              channel: "both",
              fromUserId: observerId,
              relatedModel: "BehavioralObservation",
              relatedId: observation._id,
              io
            });
          }
        }
      }
    }

    res.status(201).json({ success: true, message: "Behavioral observation logged successfully", data: observation });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/caregiver-dashboard/behavioral-observations/:patientId — Get observations
exports.getBehavioralObservations = async (req, res, next) => {
  try {
    const patientUserId = req.params.patientId;
    const caregiverId = req.user._id;
    await verifyCaregiverAssignment(caregiverId, patientUserId);

    const observations = await BehavioralObservation.find({ patientUserId })
      .populate("observedBy", "firstName lastName")
      .sort({ observedAt: -1 });

    res.status(200).json({ success: true, data: observations });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// POST /api/caregiver-dashboard/mood — Log mood (Caregiver or Patient self)
exports.logMood = async (req, res, next) => {
  try {
    const loggedByUserId = req.user._id;
    const role = req.user.role;
    const { patientUserId, mood, energyLevel, notes } = req.body;

    if (!mood || !energyLevel) {
      return res.status(400).json({ success: false, message: "mood and energyLevel are required." });
    }

    const finalPatientUserId = patientUserId || loggedByUserId;

    if (role === "caregiver") {
      await verifyCaregiverAssignment(loggedByUserId, finalPatientUserId);
    } else if (role === "patient" && finalPatientUserId.toString() !== loggedByUserId.toString()) {
      return res.status(403).json({ success: false, message: "You can only log your own mood." });
    }

    const log = await MoodTracking.create({
      patientUserId: finalPatientUserId,
      mood,
      energyLevel,
      notes: notes || "",
      loggedBy: role === "caregiver" ? "caregiver" : "self",
      loggedByUserId
    });

    // Real-time notification (non-blocking)
    try {
      const io = req.app.locals.io;

      if (role === "patient") {
        // Patient logged mood → notify caregivers
        const patientUser = await User.findById(loggedByUserId).select("firstName lastName");
        const patientProfile = await Patient.findOne({ userId: loggedByUserId });

        if (patientProfile?.assignedCaregivers) {
          for (const cgId of patientProfile.assignedCaregivers) {
            if (io) {
              io.to(cgId.toString()).emit("mood_update", {
                patientId: loggedByUserId,
                patientName: `${patientUser.firstName} ${patientUser.lastName}`,
                mood
              });
            }

            await notificationService.createNotification({
              userId: cgId,
              type: "mood_update",
              title: `Mood Alert: ${patientUser.firstName} is feeling ${mood}`,
              message: `${patientUser.firstName} logged their mood as ${mood} (Energy level: ${energyLevel}/5).${notes ? " Notes: " + notes : ""}`,
              priority: "normal",
              channel: "both",
              fromUserId: loggedByUserId,
              relatedModel: "MoodTracking",
              relatedId: log._id,
              io
            });
          }
        }
      } else if (role === "caregiver") {
        // Caregiver logged mood → notify the patient
        const caregiverUser = await User.findById(loggedByUserId).select("firstName lastName");
        const caregiverName = `${caregiverUser?.firstName || ""} ${caregiverUser?.lastName || ""}`.trim();

        if (io) {
          io.to(finalPatientUserId.toString()).emit("mood_update", {
            mood,
            loggedBy: caregiverName
          });
        }

        await notificationService.createNotification({
          userId: finalPatientUserId,
          type: "mood_update",
          title: `Your caregiver logged your mood as ${mood}`,
          message: `${caregiverName} logged your mood as ${mood} (Energy level: ${energyLevel}/5).${notes ? " Notes: " + notes : ""}`,
          priority: "normal",
          channel: "both",
          fromUserId: loggedByUserId,
          relatedModel: "MoodTracking",
          relatedId: log._id,
          io
        });
      }
    } catch (notifErr) {
      console.error("⚠️ Mood notification failed (mood still saved):", notifErr.message);
    }

    res.status(201).json({ success: true, message: "Mood logged successfully", data: log });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/caregiver-dashboard/mood/:patientId — Get mood history
exports.getMoodHistory = async (req, res, next) => {
  try {
    const patientUserId = req.params.patientId;
    const caregiverId = req.user._id;
    if (req.user.role === "caregiver") {
      await verifyCaregiverAssignment(caregiverId, patientUserId);
    } else if (req.user.role === "patient" && patientUserId.toString() !== caregiverId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    const history = await MoodTracking.find({ patientUserId })
      .populate("loggedByUserId", "firstName lastName")
      .sort({ date: -1 });

    res.status(200).json({ success: true, data: history });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// POST /api/caregiver-dashboard/emergency-contacts — Add emergency contact
exports.addEmergencyContact = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;
    const { patientUserId, name, relation, phone, email, isPrimary, canReceiveAlerts, notificationPreferences } = req.body;

    if (!name || !relation || !phone) {
      return res.status(400).json({ success: false, message: "name, relation, and phone are required." });
    }

    const finalPatientUserId = patientUserId || userId;

    if (role === "caregiver") {
      await verifyCaregiverAssignment(userId, finalPatientUserId);
    } else if (role === "patient" && finalPatientUserId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    // If making primary, unset other primary contacts first
    if (isPrimary) {
      await EmergencyContact.updateMany({ patientUserId: finalPatientUserId }, { isPrimary: false });
    }

    const contact = await EmergencyContact.create({
      patientUserId: finalPatientUserId,
      name,
      relation,
      phone,
      email: email || "",
      isPrimary: isPrimary || false,
      canReceiveAlerts: canReceiveAlerts !== undefined ? canReceiveAlerts : true,
      notificationPreferences: notificationPreferences || { missedDose: true, emergencyOnly: false, dailyReport: false }
    });

    res.status(201).json({ success: true, message: "Emergency contact added successfully", data: contact });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/caregiver-dashboard/emergency-contacts/:patientId — Get emergency contacts
exports.getEmergencyContacts = async (req, res, next) => {
  try {
    const patientUserId = req.params.patientId;
    const userId = req.user._id;
    const role = req.user.role;

    if (role === "caregiver") {
      await verifyCaregiverAssignment(userId, patientUserId);
    } else if (role === "patient" && patientUserId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    const contacts = await EmergencyContact.find({ patientUserId })
      .sort({ isPrimary: -1, name: 1 });

    res.status(200).json({ success: true, data: contacts });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// PUT /api/caregiver-dashboard/emergency-contacts/:id — Update emergency contact
exports.updateEmergencyContact = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;
    const contactId = req.params.id;
    const { name, relation, phone, email, isPrimary, canReceiveAlerts, notificationPreferences } = req.body;

    const contact = await EmergencyContact.findById(contactId);
    if (!contact) {
      return res.status(404).json({ success: false, message: "Emergency contact not found." });
    }

    if (role === "caregiver") {
      await verifyCaregiverAssignment(userId, contact.patientUserId);
    } else if (role === "patient" && contact.patientUserId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    if (isPrimary) {
      await EmergencyContact.updateMany({ patientUserId: contact.patientUserId }, { isPrimary: false });
    }

    contact.name = name || contact.name;
    contact.relation = relation || contact.relation;
    contact.phone = phone || contact.phone;
    contact.email = email !== undefined ? email : contact.email;
    contact.isPrimary = isPrimary !== undefined ? isPrimary : contact.isPrimary;
    contact.canReceiveAlerts = canReceiveAlerts !== undefined ? canReceiveAlerts : contact.canReceiveAlerts;
    contact.notificationPreferences = notificationPreferences || contact.notificationPreferences;

    await contact.save();

    res.status(200).json({ success: true, message: "Emergency contact updated successfully", data: contact });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/caregiver-dashboard/emergency-contacts/:id — Delete emergency contact
exports.deleteEmergencyContact = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;
    const contactId = req.params.id;

    const contact = await EmergencyContact.findById(contactId);
    if (!contact) {
      return res.status(404).json({ success: false, message: "Emergency contact not found." });
    }

    if (role === "caregiver") {
      await verifyCaregiverAssignment(userId, contact.patientUserId);
    } else if (role === "patient" && contact.patientUserId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    await EmergencyContact.deleteOne({ _id: contactId });

    res.status(200).json({ success: true, message: "Emergency contact deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// GET /api/caregiver-dashboard/alerts — Get all active caregiver alerts
exports.getAlerts = async (req, res, next) => {
  try {
    const caregiverId = req.user._id;

    // Fetch unread notifications where type is missed_dose, escalation, cognitive_alert, or behavioral_alert
    const alerts = await Notification.find({
      userId: caregiverId,
      isRead: false,
      type: { $in: ["missed_dose", "escalation", "cognitive_alert", "behavioral_alert"] }
    })
      .populate("fromUserId", "firstName lastName avatar")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: alerts });
  } catch (error) {
    next(error);
  }
};
