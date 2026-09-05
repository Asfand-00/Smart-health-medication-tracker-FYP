/**
 * SMART REMINDER SERVICE — smartReminder.service.js
 * ===================================================
 * Automated reminder generation, voice text-to-speech,
 * one-tap confirmation, and caregiver escalation logic.
 * 
 * FLOW:
 * 1. generateReminders() → creates today's reminders from active medications
 * 2. getUpcomingReminders() → returns pending (unread) reminders for today
 * 3. acknowledgeReminder() → marks reminder done, logs adherence, notifies caregiver via socket
 * 4. escalateReminder() → auto-escalation for missed doses
 */

const Reminder = require("../reminder/reminder.model");
const ReminderHistory = require("../adherence/reminderHistory.model");
const AdherenceLog = require("../adherence/adherenceLog.model");
const Medication = require("../medication/medication.model");
const Patient = require("../patient/patient.model");
const Notification = require("../notification/notification.model");
const User = require("../user/user.model");
const MedicationHistory = require("../medication/medicationHistory.model");
const notificationService = require("../notification/notification.service");

// Mapping times of day to target hours
const TIME_MAPPING = {
  Morning: 8,
  Afternoon: 13,
  Evening: 18,
  Night: 21
};

/**
 * Auto-generate reminders from medication schedule for today
 */
const generateReminders = async (userId) => {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  // Find all active medications for the user
  const medications = await Medication.find({
    userId,
    startDate: { $lte: endOfDay },
    $or: [{ endDate: null }, { endDate: { $gte: startOfDay } }]
  });

  if (medications.length === 0) {
    return [];
  }

  const generated = [];

  for (const med of medications) {
    for (const timeName of med.timeOfDay) {
      const targetHour = TIME_MAPPING[timeName] || 8;
      const scheduledTime = new Date(now);
      scheduledTime.setHours(targetHour, 0, 0, 0);

      // Check if reminder already exists for today at this timeOfDay for this medication
      const existing = await Reminder.findOne({
        patientUserId: userId,
        medicationId: med._id,
        scheduledTime: {
          $gte: startOfDay,
          $lte: endOfDay
        },
        title: { $regex: timeName, $options: "i" }
      });

      if (!existing) {
        // Create new reminder
        const reminder = await Reminder.create({
          createdBy: userId,
          patientUserId: userId,
          title: `💊 Time for your ${timeName} Medication`,
          message: `Please take ${med.medicineName} (${med.dosage}).`,
          reminderType: "medication",
          medicationId: med._id,
          scheduledTime,
          isRead: false
        });

        // Initialize pending AdherenceLog
        const logDate = new Date();
        logDate.setHours(0, 0, 0, 0);
        try {
          await AdherenceLog.findOneAndUpdate(
            { userId, medicationId: med._id, date: logDate, timeOfDay: timeName },
            {
              userId,
              patientId: med.patientId,
              medicationId: med._id,
              date: logDate,
              timeOfDay: timeName,
              status: "pending",
              scheduledTime
            },
            { upsert: true, new: true }
          );
        } catch (logErr) {
          // If adherence log creation fails (e.g. duplicate), continue
          console.log(`AdherenceLog init skipped for ${med.medicineName} ${timeName}:`, logErr.message);
        }

        generated.push(reminder);
      }
    }
  }

  return generated;
};

/**
 * Get upcoming reminders for today (only unacknowledged ones)
 */
const getUpcomingReminders = async (userId) => {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  return await Reminder.find({
    patientUserId: userId,
    scheduledTime: { $gte: startOfDay, $lte: endOfDay },
    isRead: false
  }).populate("medicationId", "medicineName dosage notes description timeOfDay");
};

/**
 * Acknowledge reminder (one-tap confirmation)
 * This is the CORE function that:
 * 1. Marks reminder as read
 * 2. Updates AdherenceLog (taken/skipped/delayed) 
 * 3. Updates legacy MedicationHistory for backward compat
 * 4. Logs in ReminderHistory for analytics
 * 5. Emits socket events to patient dashboard + caregiver
 * 6. Creates notification for caregiver if skipped/missed
 */
const acknowledgeReminder = async (reminderId, userId, { status, notes }, io) => {
  const reminder = await Reminder.findOne({ _id: reminderId, patientUserId: userId });
  if (!reminder) {
    throw { status: 404, message: "Reminder not found or unauthorized." };
  }

  // 1. Mark reminder as read
  reminder.isRead = true;
  await reminder.save();

  // 2. Find corresponding medication
  const med = await Medication.findById(reminder.medicationId);
  const timeName = Object.keys(TIME_MAPPING).find(key => 
    reminder.title.toLowerCase().includes(key.toLowerCase())
  ) || "Morning";

  // 3. Confirm dose in AdherenceLog
  const patient = await Patient.findOne({ userId });
  const logDate = new Date();
  logDate.setHours(0, 0, 0, 0);

  const adherenceUpdate = {
    userId,
    patientId: patient?._id,
    medicationId: reminder.medicationId,
    date: logDate,
    timeOfDay: timeName,
    status,
    confirmedAt: status === "taken" ? new Date() : null,
    delayMinutes: status === "delayed" ? calculateDelay(timeName) : 0,
    loggedBy: "self",
    notes: notes || "",
  };

  const log = await AdherenceLog.findOneAndUpdate(
    { userId, medicationId: reminder.medicationId, date: logDate, timeOfDay: timeName },
    adherenceUpdate,
    { new: true, upsert: true, runValidators: true }
  );

  // 4. Update legacy MedicationHistory for backward compatibility
  const legacyStatus = status === "delayed" ? "taken" : status === "skipped" ? "missed" : status;
  try {
    await MedicationHistory.findOneAndUpdate(
      { medicationId: reminder.medicationId, userId, date: logDate, timeOfDay: timeName },
      { medicationId: reminder.medicationId, userId, patientId: patient?._id, date: logDate, timeOfDay: timeName, status: legacyStatus },
      { upsert: true, new: true }
    );
  } catch (histErr) {
    console.log("Legacy MedicationHistory update skipped:", histErr.message);
  }

  // 5. Calculate response time and log in ReminderHistory
  const firedAt = reminder.createdAt;
  const now = new Date();
  const responseTime = Math.round((now.getTime() - firedAt.getTime()) / 1000);

  const history = await ReminderHistory.create({
    userId,
    medicationId: reminder.medicationId,
    reminderId: reminder._id,
    scheduledTime: reminder.scheduledTime || firedAt,
    firedAt,
    acknowledgedAt: now,
    responseTime,
    wasEffective: status === "taken" || status === "delayed",
    channel: "in_app",
    attempt: 1,
    timeOfDay: timeName
  });

  // 6. REAL-TIME UPDATES via Socket.io
  if (io) {
    const patientUser = await User.findById(userId).select("firstName lastName");
    const patientName = `${patientUser?.firstName || ""} ${patientUser?.lastName || ""}`.trim();

    // A) Emit to patient's own dashboard to update adherence stats
    io.to(userId.toString()).emit("adherence_update", {
      log,
      medication: med ? { medicineName: med.medicineName, dosage: med.dosage } : null,
      status,
      timeOfDay: timeName,
      timestamp: now
    });

    // Send email/notification to patient themselves if skipped
    if (status === "skipped") {
      await notificationService.createNotification({
        userId,
        type: "missed_dose",
        title: `⚠️ You skipped a dose`,
        message: `You marked your scheduled ${med?.medicineName || "medication"} (${timeName}) as skipped.`,
        priority: "high",
        channel: "both",
        fromUserId: userId,
        relatedModel: "AdherenceLog",
        relatedId: log._id,
        io
      });
    }

    // B) Notify all assigned caregivers
    if (patient?.assignedCaregivers?.length > 0) {
      const populatedPatient = await Patient.findOne({ userId })
        .populate("assignedCaregivers", "_id email firstName lastName");
      
      if (populatedPatient?.assignedCaregivers) {
        for (const cg of populatedPatient.assignedCaregivers) {
          // Real-time event to caregiver dashboard
          io.to(cg._id.toString()).emit("patient_dose_update", {
            patientId: userId,
            patientName,
            medicationName: med?.medicineName || "Medication",
            dosage: med?.dosage || "",
            timeOfDay: timeName,
            status,
            confirmedAt: now,
            timestamp: now
          });

          // If skipped → send critical alert to caregiver
          if (status === "skipped") {
            io.to(cg._id.toString()).emit("patient_missed_medication", {
              patientId: userId,
              patientName,
              medicationName: med?.medicineName || "Medication",
              timeOfDay: timeName,
              timestamp: now,
            });

            // Create notification record in DB
            await notificationService.createNotification({
              userId: cg._id,
              type: "missed_dose",
              title: `⚠️ ${patientName} skipped a dose`,
              message: `${patientName} skipped ${med?.medicineName || "medication"} (${timeName})`,
              priority: "high",
              channel: "both",
              fromUserId: userId,
              relatedModel: "AdherenceLog",
              relatedId: log._id,
              io
            });
          }

          // If taken → send positive update notification
          if (status === "taken") {
            await notificationService.createNotification({
              userId: cg._id,
              type: "system",
              title: `✅ ${patientName} took medication`,
              message: `${patientName} confirmed ${med?.medicineName || "medication"} (${timeName}) dose.`,
              priority: "low",
              channel: "in_app",
              fromUserId: userId,
              relatedModel: "AdherenceLog",
              relatedId: log._id,
              io
            });
          }
        }
      }
    }
  }

  return { reminder, log, history };
};

/**
 * Calculate delay in minutes from expected time
 */
const calculateDelay = (timeOfDay) => {
  const now = new Date();
  const hours = now.getHours();
  const expected = TIME_MAPPING[timeOfDay] || 8;
  return Math.max(0, (hours - expected) * 60 + now.getMinutes());
};

/**
 * Get reminder history
 */
const getReminderHistory = async (userId) => {
  return await ReminderHistory.find({ userId })
    .populate("medicationId", "medicineName dosage")
    .sort({ firedAt: -1 });
};

/**
 * Adaptive timing suggestions
 */
const getAdaptiveSuggestions = async (userId) => {
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const historyLogs = await ReminderHistory.find({
    userId,
    firedAt: { $gte: twoWeeksAgo },
    wasEffective: true
  }).populate("medicationId", "medicineName");

  if (historyLogs.length === 0) {
    return { suggestions: [], message: "Not enough historical data to generate suggestions yet." };
  }

  const times = { Morning: [], Afternoon: [], Evening: [], Night: [] };
  historyLogs.forEach(log => {
    if (log.timeOfDay && times[log.timeOfDay]) {
      const delay = Math.round(log.responseTime / 60);
      times[log.timeOfDay].push(delay);
    }
  });

  const suggestions = [];
  Object.keys(times).forEach(timeName => {
    const delays = times[timeName];
    if (delays.length >= 3) {
      const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
      if (avgDelay >= 30) {
        const currentTargetHour = TIME_MAPPING[timeName];
        const newHour = currentTargetHour + Math.round(avgDelay / 60);
        suggestions.push({
          timeOfDay: timeName,
          avgDelayMinutes: Math.round(avgDelay),
          currentScheduledTime: `${currentTargetHour}:00`,
          suggestedTime: `${newHour}:00`,
          reason: `Patient consistently acknowledges their ${timeName} reminder about ${Math.round(avgDelay)} minutes later.`
        });
      }
    }
  });

  return {
    suggestions,
    message: suggestions.length > 0 
      ? `Found ${suggestions.length} adaptive scheduling optimization opportunities.`
      : "Medication adherence timing is aligned with scheduled times."
  };
};

/**
 * Escalation workflow (Triggered by background runner)
 */
const escalateReminder = async (reminderId, io) => {
  const reminder = await Reminder.findById(reminderId).populate("medicationId", "medicineName");
  if (!reminder || reminder.isRead) return null;

  const now = new Date();
  const baseTime = reminder.scheduledTime || reminder.createdAt;
  const diffMinutes = Math.round((now.getTime() - baseTime.getTime()) / (1000 * 60));

  let currentLevel = 1;
  if (diffMinutes >= 30) {
    currentLevel = 3;
  } else if (diffMinutes >= 15) {
    currentLevel = 2;
  }

  const timeName = Object.keys(TIME_MAPPING).find(key => 
    reminder.title.toLowerCase().includes(key.toLowerCase())
  ) || "Morning";

  const logDate = new Date();
  logDate.setHours(0, 0, 0, 0);

  // Update escalationLevel, and if level is 3, transition status to 'overdue'
  const updateFields = { escalationLevel: currentLevel };
  if (currentLevel === 3) {
    updateFields.status = "overdue";
  }

  const log = await AdherenceLog.findOneAndUpdate(
    { userId: reminder.patientUserId, medicationId: reminder.medicationId, date: logDate, timeOfDay: timeName },
    updateFields,
    { new: true }
  );

  const patientUser = await User.findById(reminder.patientUserId).select("firstName lastName");
  const patientProfile = await Patient.findOne({ userId: reminder.patientUserId })
    .populate("assignedCaregivers", "_id email firstName lastName");

  if (currentLevel === 2) {
    if (io) {
      io.to(reminder.patientUserId.toString()).emit("new_reminder", {
        _id: reminder._id,
        title: `⚠️ Urgent: ${reminder.title}`,
        message: `${reminder.message} Please respond to this reminder!`,
        reminderType: "medication",
        critical: true,
        speechText: `Attention, ${patientUser?.firstName}. This is your second reminder. Please take your medication, ${reminder.medicationId?.medicineName || "medicine"}, now.`
      });
    }
  } else if (currentLevel === 3) {
    // Notify patient themselves (DB + Email)
    await notificationService.createNotification({
      userId: reminder.patientUserId,
      type: "missed_dose",
      title: `🚨 Overdue Medication Alert`,
      message: `You have an overdue ${timeName} dose of ${reminder.medicationId?.medicineName || "medication"}. Please take your medicine and confirm it now.`,
      priority: "critical",
      channel: "both",
      fromUserId: reminder.patientUserId,
      relatedModel: "Reminder",
      relatedId: reminder._id,
      io
    });

    // Refresh patient dashboard
    if (io) {
      io.to(reminder.patientUserId.toString()).emit("medication_updated");
      io.to(reminder.patientUserId.toString()).emit("adherence_update", {
        log,
        medication: reminder.medicationId ? { medicineName: reminder.medicationId.medicineName } : null,
        status: "overdue",
        timeOfDay: timeName,
        timestamp: now
      });
    }

    if (patientProfile?.assignedCaregivers) {
      const patientName = `${patientUser?.firstName || ""} ${patientUser?.lastName || ""}`.trim();
      for (const cg of patientProfile.assignedCaregivers) {
        if (io) {
          io.to(cg._id.toString()).emit("escalation_alert", {
            patientId: reminder.patientUserId,
            patientName,
            title: `🚨 Escalation Level 3: Overdue Medication`,
            message: `${patientName} has not taken their scheduled ${reminder.medicationId?.medicineName || "medication"} (${timeName}).`,
            createdAt: new Date()
          });
          io.to(cg._id.toString()).emit("patient_dose_update", {
            patientId: reminder.patientUserId,
            patientName,
            medicationName: reminder.medicationId?.medicineName || "Medication",
            timeOfDay: timeName,
            status: "overdue",
            timestamp: now
          });
        }

        await notificationService.createNotification({
          userId: cg._id,
          type: "escalation",
          title: `🚨 Overdue medication alert for ${patientUser?.firstName}`,
          message: `${patientUser?.firstName} has an overdue ${timeName} dose of ${reminder.medicationId?.medicineName || "medication"}. Escalation level 3 reached.`,
          priority: "critical",
          channel: "both",
          fromUserId: reminder.patientUserId,
          relatedModel: "Reminder",
          relatedId: reminder._id,
          io
        });

        console.log(`\n🚨 [ESCALATION ALERT] Caregiver ${cg.firstName} notified about ${patientUser?.firstName}'s overdue ${timeName} medication.\n`);
      }
    }
  }

  return log;
};

/**
 * Get unacknowledged/missed reminders
 */
const getMissedReminders = async (userId) => {
  return await Reminder.find({
    patientUserId: userId,
    isRead: false,
    scheduledTime: { $lt: new Date() }
  }).populate("medicationId", "medicineName dosage");
};

module.exports = {
  generateReminders,
  getUpcomingReminders,
  acknowledgeReminder,
  getReminderHistory,
  getAdaptiveSuggestions,
  escalateReminder,
  getMissedReminders
};
