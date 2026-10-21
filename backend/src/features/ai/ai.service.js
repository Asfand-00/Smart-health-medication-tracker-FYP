/**
 * AI SERVICE — ai.service.js
 * ===========================
 * "AI-Based Prediction and Alerts". The project document chooses rule-based
 * / statistical techniques for now (machine learning when more data exists),
 * so this module implements:
 *
 *  predictMissedDoses   per medication × time-slot probability of a missed
 *                       dose, from a Laplace-smoothed, recency-weighted miss
 *                       rate, a day-of-week factor and a trend factor
 *  analyzeBehavior      patterns: by weekday, by slot, streaks, consistency,
 *                       response time to reminders, mood correlation,
 *                       weekend effect, delay tendency
 *  detectRisks          flags irregular habits (consecutive misses, declining
 *                       trend, chronic slot, slow response, cognitive decline,
 *                       behavioural concerns, polypharmacy, interactions)
 *  recommendations      personalised, actionable suggestions
 *  runPreventiveAlerts  scheduled job: stores AiAlert records and notifies the
 *                       patient (and the care circle for high risk)
 */

const AdherenceLog = require("../adherence/adherenceLog.model");
const Medication = require("../medication/medication.model");
const ReminderHistory = require("../adherence/reminderHistory.model");
const MoodTracking = require("../patient/moodTracking.model");
const CognitiveAssessment = require("../patient/cognitiveAssessment.model");
const BehavioralObservation = require("../patient/behavioralObservation.model");
const NotificationSettings = require("../notification/notificationSettings.model");
const SystemConfig = require("../admin/systemConfig.model");
const User = require("../user/user.model");
const AiAlert = require("./aiAlert.model");
const notificationService = require("../notification/notification.service");
const drugInfo = require("../medication/drugInfo.service");
const { getCareCircle } = require("../../utils/access");

const SLOTS = ["Morning", "Afternoon", "Evening", "Night"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SLOT_HOUR = { Morning: 8, Afternoon: 13, Evening: 18, Night: 21 };

const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const isMiss = (status) => status === "missed" || status === "skipped" || status === "overdue";
const isDone = (status) => status === "taken" || status === "delayed";
const riskLevel = (p) => (p >= 0.75 ? "critical" : p >= 0.55 ? "high" : p >= 0.35 ? "moderate" : "low");
const round2 = (n) => Math.round(n * 100) / 100;

/** Logs in the lookback window, with 'pending' past slots treated as missed. */
const loadLogs = async (patientUserId, lookbackDays) => {
  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);
  since.setHours(0, 0, 0, 0);
  const now = new Date();
  const logs = await AdherenceLog.find({ userId: patientUserId, date: { $gte: since } }).populate("medicationId", "medicineName dosage").sort({ date: 1 });
  return logs
    .map((l) => {
      let status = l.status;
      if (status === "pending") {
        const due = new Date(l.date);
        due.setHours(SLOT_HOUR[l.timeOfDay] || 8, 30, 0, 0);
        status = due < now ? "missed" : "pending";
      }
      return { ...l.toObject(), status, medicationId: l.medicationId?._id || l.medicationId, medicineName: l.medicationId?.medicineName || "Medication" };
    })
    .filter((l) => l.status !== "pending");
};

// ── 1. Missed-dose prediction ──────────────────────────────────────────
const predictMissedDoses = async (patientUserId, { logs, lookbackDays }) => {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const medications = await Medication.find({ userId: patientUserId, startDate: { $lte: now }, $or: [{ endDate: null }, { endDate: { $gte: todayStart } }] });

  const total = logs.length;
  const missedAll = logs.filter((l) => isMiss(l.status)).length;
  const baseRate = (missedAll + 1) / (total + 2); // Laplace smoothing

  // Day-of-week factor
  const byDow = DAYS.map(() => ({ miss: 0, total: 0 }));
  logs.forEach((l) => {
    const d = new Date(l.date).getDay();
    byDow[d].total += 1;
    if (isMiss(l.status)) byDow[d].miss += 1;
  });

  // Trend: last 7 days vs previous 7
  const sevenAgo = new Date(todayStart);
  sevenAgo.setDate(sevenAgo.getDate() - 7);
  const fourteenAgo = new Date(todayStart);
  fourteenAgo.setDate(fourteenAgo.getDate() - 14);
  const recent = logs.filter((l) => new Date(l.date) >= sevenAgo);
  const previous = logs.filter((l) => new Date(l.date) >= fourteenAgo && new Date(l.date) < sevenAgo);
  const rate = (arr) => (arr.length ? arr.filter((l) => isMiss(l.status)).length / arr.length : null);
  const recentRate = rate(recent);
  const prevRate = rate(previous);
  const trendDelta = recentRate !== null && prevRate !== null ? recentRate - prevRate : 0;

  const predictions = [];
  for (const med of medications) {
    for (const slot of med.timeOfDay) {
      const slotLogs = logs.filter((l) => l.medicationId?.toString() === med._id.toString() && l.timeOfDay === slot);
      // Recency weighting: a log k days old weighs 0.93^k
      let wMiss = 0;
      let wTotal = 0;
      slotLogs.forEach((l) => {
        const ageDays = Math.max(0, Math.floor((todayStart - new Date(l.date)) / 86400000));
        const w = Math.pow(0.93, ageDays);
        wTotal += w;
        if (isMiss(l.status)) wMiss += w;
      });
      // Blend slot evidence with the overall base rate (prior strength 2)
      const slotRate = (wMiss + baseRate * 2) / (wTotal + 2);

      // Which day are we predicting? Next occurrence of this slot.
      const due = new Date(todayStart);
      due.setHours(SLOT_HOUR[slot], 0, 0, 0);
      const alreadyLogged = await AdherenceLog.findOne({ userId: patientUserId, medicationId: med._id, timeOfDay: slot, date: todayStart, status: { $ne: "pending" } });
      if (due < now || alreadyLogged) due.setDate(due.getDate() + 1);
      const dow = byDow[due.getDay()];
      const dowRate = dow.total >= 3 ? (dow.miss + 1) / (dow.total + 2) : baseRate;
      const dowFactor = baseRate > 0 ? Math.min(1.6, Math.max(0.6, dowRate / baseRate)) : 1;

      // Consecutive misses in this slot amplify risk
      const lastThree = slotLogs.slice(-3);
      const streak = lastThree.length && lastThree.every((l) => isMiss(l.status)) ? lastThree.length : 0;
      const streakBoost = streak >= 3 ? 0.2 : streak === 2 ? 0.12 : streak === 1 ? 0.05 : 0;

      let probability = slotRate * dowFactor + streakBoost + Math.max(-0.1, Math.min(0.15, trendDelta));
      probability = Math.min(0.97, Math.max(0.03, probability));

      const reasons = [];
      if (slotLogs.length === 0) reasons.push("No history for this slot yet — estimate based on overall adherence.");
      if (wTotal > 0 && wMiss / wTotal >= 0.3) reasons.push(`${Math.round((wMiss / wTotal) * 100)}% of recent ${slot.toLowerCase()} doses of ${med.medicineName} were missed.`);
      if (dowFactor >= 1.25) reasons.push(`${DAYS[due.getDay()]}s are a weaker day for this patient.`);
      if (streak >= 2) reasons.push(`${streak} consecutive misses in this slot.`);
      if (trendDelta >= 0.1) reasons.push("Adherence has declined over the last week.");
      if (trendDelta <= -0.1) reasons.push("Adherence improved over the last week.");

      predictions.push({
        medicationId: med._id,
        medicineName: med.medicineName,
        dosage: med.dosage,
        timeOfDay: slot,
        nextDue: due,
        nextDueDate: dateKey(due),
        probability: round2(probability),
        riskLevel: riskLevel(probability),
        sampleSize: slotLogs.length,
        reasons,
      });
    }
  }
  predictions.sort((a, b) => b.probability - a.probability);
  return {
    predictions,
    overall: { baseMissRate: round2(baseRate), recentMissRate: recentRate === null ? null : round2(recentRate), trend: trendDelta >= 0.1 ? "declining" : trendDelta <= -0.1 ? "improving" : "stable", sampleSize: total, lookbackDays },
  };
};

// ── 2. Behavioural pattern analysis ───────────────────────────────────
const analyzeBehavior = async (patientUserId, { logs, lookbackDays }) => {
  const insights = [];
  const total = logs.length;
  const missed = logs.filter((l) => isMiss(l.status));
  const taken = logs.filter((l) => isDone(l.status));
  const delayed = logs.filter((l) => l.status === "delayed");

  const byWeekday = DAYS.map((name, i) => {
    const dayLogs = logs.filter((l) => new Date(l.date).getDay() === i);
    const m = dayLogs.filter((l) => isMiss(l.status)).length;
    return { day: name, total: dayLogs.length, missed: m, missRate: dayLogs.length ? round2(m / dayLogs.length) : null };
  });
  const bySlot = SLOTS.map((slot) => {
    const slotLogs = logs.filter((l) => l.timeOfDay === slot);
    const m = slotLogs.filter((l) => isMiss(l.status)).length;
    return { slot, total: slotLogs.length, missed: m, missRate: slotLogs.length ? round2(m / slotLogs.length) : null };
  });

  // Streaks by day: a day counts as complete when no dose was missed
  const dayMap = new Map();
  logs.forEach((l) => {
    const k = dateKey(new Date(l.date));
    const cur = dayMap.get(k) || { miss: 0, total: 0 };
    cur.total += 1;
    if (isMiss(l.status)) cur.miss += 1;
    dayMap.set(k, cur);
  });
  const days = [...dayMap.keys()].sort();
  let currentStreak = 0;
  let longestStreak = 0;
  let run = 0;
  days.forEach((k) => {
    if (dayMap.get(k).miss === 0) {
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else run = 0;
  });
  currentStreak = run;

  // Consistency = share of days fully adherent
  const fullDays = days.filter((k) => dayMap.get(k).miss === 0).length;
  const consistencyScore = days.length ? Math.round((fullDays / days.length) * 100) : null;

  // Response time to reminders
  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);
  const reminders = await ReminderHistory.find({ userId: patientUserId, firedAt: { $gte: since }, responseTime: { $ne: null } });
  const avgResponseMin = reminders.length ? Math.round(reminders.reduce((s, r) => s + r.responseTime, 0) / reminders.length / 60) : null;

  // Weekend effect
  const weekend = logs.filter((l) => [0, 6].includes(new Date(l.date).getDay()));
  const weekday = logs.filter((l) => ![0, 6].includes(new Date(l.date).getDay()));
  const wkRate = weekend.length ? weekend.filter((l) => isMiss(l.status)).length / weekend.length : null;
  const wdRate = weekday.length ? weekday.filter((l) => isMiss(l.status)).length / weekday.length : null;

  // Mood correlation: miss rate on days with a negative mood vs others
  const moods = await MoodTracking.find({ patientUserId, date: { $gte: since } });
  const badMoodDays = new Set(moods.filter((m) => ["anxious", "confused", "agitated", "sad", "frustrated"].includes(m.mood)).map((m) => dateKey(new Date(m.date))));
  const onBad = logs.filter((l) => badMoodDays.has(dateKey(new Date(l.date))));
  const onOther = logs.filter((l) => !badMoodDays.has(dateKey(new Date(l.date))));
  const badRate = onBad.length ? onBad.filter((l) => isMiss(l.status)).length / onBad.length : null;
  const otherRate = onOther.length ? onOther.filter((l) => isMiss(l.status)).length / onOther.length : null;

  // Insights (text, with severity)
  const worstSlot = bySlot.filter((s) => s.total >= 3).sort((a, b) => (b.missRate ?? 0) - (a.missRate ?? 0))[0];
  if (worstSlot && worstSlot.missRate >= 0.3) insights.push({ severity: worstSlot.missRate >= 0.5 ? "high" : "moderate", title: `${worstSlot.slot} doses are missed most`, detail: `${Math.round(worstSlot.missRate * 100)}% of ${worstSlot.slot.toLowerCase()} doses were missed (${worstSlot.missed} of ${worstSlot.total}).` });
  const worstDay = byWeekday.filter((d) => d.total >= 3).sort((a, b) => (b.missRate ?? 0) - (a.missRate ?? 0))[0];
  if (worstDay && worstDay.missRate >= 0.3) insights.push({ severity: "moderate", title: `${worstDay.day} is the weakest day`, detail: `${Math.round(worstDay.missRate * 100)}% of doses on ${worstDay.day}s were missed.` });
  if (wkRate !== null && wdRate !== null && wkRate - wdRate >= 0.15) insights.push({ severity: "moderate", title: "Weekend routine breaks down", detail: `Weekend miss rate ${Math.round(wkRate * 100)}% vs ${Math.round(wdRate * 100)}% on weekdays.` });
  if (badRate !== null && otherRate !== null && badRate - otherRate >= 0.15) insights.push({ severity: "high", title: "Low mood predicts missed doses", detail: `On days logged as anxious/confused/sad, ${Math.round(badRate * 100)}% of doses were missed vs ${Math.round(otherRate * 100)}% otherwise.` });
  if (total >= 5 && delayed.length / total >= 0.25) insights.push({ severity: "low", title: "Doses are often taken late", detail: `${Math.round((delayed.length / total) * 100)}% of doses were delayed. The scheduled time may be too early.` });
  if (avgResponseMin !== null && avgResponseMin >= 45) insights.push({ severity: "moderate", title: "Slow response to reminders", detail: `Reminders are acknowledged after ${avgResponseMin} minutes on average.` });
  if (longestStreak >= 7) insights.push({ severity: "low", title: `Best streak: ${longestStreak} fully adherent days`, detail: currentStreak >= 3 ? `Currently on a ${currentStreak}-day streak — keep it up.` : "Rebuilding the routine will restore this streak." });
  if (total < 10) insights.push({ severity: "low", title: "Limited history", detail: `Only ${total} dose records in the last ${lookbackDays} days. Patterns become reliable after about two weeks of logging.` });

  return {
    sampleSize: total,
    takenCount: taken.length,
    missedCount: missed.length,
    delayedCount: delayed.length,
    adherenceRate: total ? Math.round((taken.length / total) * 100) : null,
    consistencyScore,
    currentStreak,
    longestStreak,
    avgResponseMinutes: avgResponseMin,
    byWeekday,
    bySlot,
    weekendEffect: { weekendMissRate: wkRate === null ? null : round2(wkRate), weekdayMissRate: wdRate === null ? null : round2(wdRate) },
    moodCorrelation: { badMoodMissRate: badRate === null ? null : round2(badRate), otherMissRate: otherRate === null ? null : round2(otherRate), badMoodDays: badMoodDays.size },
    insights,
  };
};

// ── 3. Risk detection ──────────────────────────────────────────────────
const detectRisks = async (patientUserId, { logs, predictions, behavior }) => {
  const flags = [];
  const push = (code, severity, title, detail, recommendation) => flags.push({ code, severity, title, detail, recommendation });

  // Consecutive misses of the same dose (medication + time slot), most recent first
  const bySlot = new Map();
  logs.forEach((l) => {
    const k = `${l.medicationId?.toString()}|${l.timeOfDay}`;
    if (!bySlot.has(k)) bySlot.set(k, { name: l.medicineName, slot: l.timeOfDay, logs: [] });
    bySlot.get(k).logs.push(l);
  });
  bySlot.forEach(({ name, slot, logs: slotLogs }) => {
    const ordered = slotLogs.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    let streak = 0;
    for (let i = ordered.length - 1; i >= 0; i--) {
      if (isMiss(ordered[i].status)) streak++;
      else break;
    }
    if (streak >= 3) push("consecutive_misses", "critical", `${name} (${slot}): ${streak} doses missed in a row`, "Repeated misses of the same dose can cause treatment failure.", "Contact the patient now and consider caregiver-administered doses for this medicine.");
    else if (streak === 2) push("consecutive_misses", "high", `${name} (${slot}): 2 doses missed in a row`, "A pattern is forming.", "Send a reminder and check for confusion about this medicine.");
  });

  if (predictions.overall.trend === "declining") push("declining_trend", "high", "Adherence is declining", `Recent miss rate ${Math.round((predictions.overall.recentMissRate || 0) * 100)}% vs base ${Math.round(predictions.overall.baseMissRate * 100)}%.`, "Increase monitoring this week and review whether the schedule is still realistic.");

  const chronic = behavior.bySlot.filter((s) => s.total >= 5 && s.missRate >= 0.5);
  chronic.forEach((s) => push("chronic_slot_miss", "high", `${s.slot} doses are missed half the time`, `${s.missed} of ${s.total} ${s.slot.toLowerCase()} doses were missed.`, `Move the ${s.slot.toLowerCase()} reminder to a time tied to a daily habit (e.g. a meal) or ask a caregiver to supervise it.`));

  if (behavior.avgResponseMinutes !== null && behavior.avgResponseMinutes >= 60) push("slow_response", "moderate", "Reminders are acknowledged very late", `Average response time ${behavior.avgResponseMinutes} minutes.`, "Turn on voice alerts and escalation to a caregiver after 15 minutes.");

  const latestCog = await CognitiveAssessment.findOne({ patientUserId }).sort({ assessmentDate: -1 });
  if (latestCog && latestCog.declineFromPrevious >= 20) push("cognitive_decline", "high", "Recent cognitive decline", `Score dropped ${latestCog.declineFromPrevious}% to ${latestCog.score}/${latestCog.maxScore}.`, "Simplify the regimen where possible and rely more on caregiver confirmation.");
  else if (latestCog && latestCog.score / latestCog.maxScore < 0.5) push("cognitive_low", "moderate", "Low cognitive score", `Latest assessment ${latestCog.score}/${latestCog.maxScore}.`, "Use large-text, voice-guided reminders and keep the daily plan as simple as possible.");

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const severeObs = await BehavioralObservation.countDocuments({ patientUserId, observedAt: { $gte: weekAgo }, severity: { $in: ["severe", "critical"] } });
  if (severeObs > 0) push("behavioral_concern", severeObs >= 2 ? "high" : "moderate", `${severeObs} severe behavioural observation(s) this week`, "Agitation, wandering or confusion episodes increase the chance of missed or double doses.", "Keep medicines locked away and administer doses with supervision during episodes.");

  const activeMeds = await Medication.find({ userId: patientUserId, $or: [{ endDate: null }, { endDate: { $gte: new Date() } }] }).select("medicineName timeOfDay");
  const dosesPerDay = activeMeds.reduce((s, m) => s + m.timeOfDay.length, 0);
  if (activeMeds.length >= 5 || dosesPerDay >= 8) push("polypharmacy", "moderate", "Complex regimen", `${activeMeds.length} medicines, ${dosesPerDay} doses a day.`, "Ask the doctor whether any medicines can be combined or moved to once-daily forms; use a pill organiser.");

  const interactions = drugInfo.checkInteractions(activeMeds.map((m) => m.medicineName));
  interactions.warnings.forEach((w) => push("drug_interaction", w.severity === "high" ? "high" : "moderate", `Possible interaction: ${w.medications.join(" + ")}`, w.message, "Confirm the combination with the prescribing doctor or pharmacist."));

  if (behavior.moodCorrelation.badMoodMissRate !== null && behavior.moodCorrelation.otherMissRate !== null && behavior.moodCorrelation.badMoodMissRate - behavior.moodCorrelation.otherMissRate >= 0.2) push("mood_linked_misses", "moderate", "Missed doses track low mood", "Doses are missed far more often on days the patient feels anxious, confused or sad.", "On low-mood days, have a caregiver check in at each dose time.");

  const order = { critical: 0, high: 1, moderate: 2, low: 3 };
  flags.sort((a, b) => order[a.severity] - order[b.severity]);
  const score = Math.min(100, flags.reduce((s, f) => s + ({ critical: 35, high: 20, moderate: 10, low: 4 }[f.severity] || 0), 0));
  return { flags, score, level: score >= 60 ? "critical" : score >= 35 ? "high" : score >= 15 ? "moderate" : "low" };
};

// ── 4. Personalised recommendations ───────────────────────────────────
const buildRecommendations = async (patientUserId, { predictions, behavior, risks }) => {
  const recs = [];
  const add = (priority, title, detail, action) => recs.push({ priority, title, detail, action });
  const settings = await NotificationSettings.getOrCreate(patientUserId);

  const top = predictions.predictions[0];
  if (top && top.probability >= 0.55) add("high", `Watch the ${top.timeOfDay.toLowerCase()} ${top.medicineName} dose`, `There is a ${Math.round(top.probability * 100)}% chance it will be missed next time.`, { type: "caregiver_supervision", timeOfDay: top.timeOfDay, medicationId: top.medicationId });

  const chronic = behavior.bySlot.filter((s) => s.total >= 5 && s.missRate >= 0.4);
  chronic.forEach((s) => {
    const current = settings.reminderTimes?.[s.slot];
    add("high", `Shift the ${s.slot.toLowerCase()} reminder`, `${Math.round(s.missRate * 100)}% of ${s.slot.toLowerCase()} doses are missed. Linking the reminder to a fixed routine (meal, TV programme) usually helps.`, { type: "adjust_reminder_time", timeOfDay: s.slot, currentTime: current });
  });

  if (behavior.delayedCount / Math.max(1, behavior.sampleSize) >= 0.25) {
    const smartReminder = require("../smart-reminder/smartReminder.service");
    const suggestions = await smartReminder.getAdaptiveSuggestions(patientUserId);
    suggestions.suggestions.forEach((s) => add("medium", `Move the ${s.timeOfDay.toLowerCase()} reminder to ${s.suggestedTime}`, s.reason, { type: "adjust_reminder_time", timeOfDay: s.timeOfDay, suggestedTime: s.suggestedTime }));
  }

  if (!settings.voiceAlerts || settings.channels.push === false) add("medium", "Turn on voice and push alerts", "Spoken reminders and lock-screen alerts are the most effective channel for patients with memory impairment.", { type: "enable_channels" });
  if (behavior.avgResponseMinutes !== null && behavior.avgResponseMinutes >= 45) add("medium", "Enable caregiver escalation", "Reminders are answered late; an escalation to the caregiver after 15 minutes closes the gap.", { type: "escalation" });
  if (risks.flags.some((f) => f.code === "polypharmacy")) add("medium", "Ask about simplifying the regimen", "Fewer daily doses mean fewer chances to forget.", { type: "doctor_review" });
  if (risks.flags.some((f) => f.code === "drug_interaction")) add("high", "Review possible drug interactions", "The current medicines include a known interacting pair.", { type: "doctor_review" });
  if (behavior.weekendEffect.weekendMissRate !== null && behavior.weekendEffect.weekdayMissRate !== null && behavior.weekendEffect.weekendMissRate - behavior.weekendEffect.weekdayMissRate >= 0.15) add("medium", "Plan weekend doses ahead", "Adherence drops at weekends. A pill organiser filled on Friday, plus a caregiver check-in, keeps the routine.", { type: "pill_organizer" });
  if (behavior.moodCorrelation.badMoodDays > 0 && behavior.moodCorrelation.badMoodMissRate !== null && behavior.moodCorrelation.badMoodMissRate >= 0.4) add("medium", "Check in on low-mood days", "Missed doses cluster on days with anxiety or confusion. Log mood each morning so caregivers can respond.", { type: "mood_checkin" });
  if (behavior.currentStreak >= 5) add("low", `Great job — ${behavior.currentStreak} days fully on track`, "Positive feedback supports the routine. Keep the same times every day.", { type: "encouragement" });
  if (recs.length === 0) add("low", "Keep the routine", "No concerning patterns were found. Keep logging every dose so the predictions stay accurate.", { type: "encouragement" });
  return recs;
};

// ── Bundle ─────────────────────────────────────────────────────────────
const getInsights = async (patientUserId) => {
  const config = await SystemConfig.getConfig();
  const lookbackDays = config.ai?.lookbackDays || 30;
  const logs = await loadLogs(patientUserId, lookbackDays);
  const predictions = await predictMissedDoses(patientUserId, { logs, lookbackDays });
  const behavior = await analyzeBehavior(patientUserId, { logs, lookbackDays });
  const risks = await detectRisks(patientUserId, { logs, predictions, behavior });
  const recommendations = await buildRecommendations(patientUserId, { predictions, behavior, risks });
  const highest = predictions.predictions[0]?.probability || 0;
  return {
    generatedAt: new Date(),
    enabled: config.ai?.enabled !== false,
    lookbackDays,
    summary: {
      riskLevel: risks.level,
      riskScore: risks.score,
      adherenceRate: behavior.adherenceRate,
      trend: predictions.overall.trend,
      highestMissProbability: highest,
      flagsCount: risks.flags.length,
      headline:
        risks.level === "critical" || risks.level === "high"
          ? "Irregular medication habits detected — intervention recommended."
          : highest >= 0.55
            ? "One or more upcoming doses are at risk of being missed."
            : behavior.sampleSize < 10
              ? "Not enough history yet — predictions improve as doses are logged."
              : "Medication habits look stable.",
    },
    predictions,
    behavior,
    risks,
    recommendations,
  };
};

// ── 5. Preventive alerts (scheduled) ──────────────────────────────────
const runPreventiveAlertsForPatient = async (patientUserId, io) => {
  const config = await SystemConfig.getConfig();
  if (config.ai?.enabled === false) return { created: 0 };
  const insights = await getInsights(patientUserId);
  const patient = await User.findById(patientUserId).select("firstName lastName");
  const circle = await getCareCircle(patientUserId);
  const careIds = [...new Set([...circle.caregivers, ...circle.doctors])];
  let created = 0;

  // a) upcoming doses likely to be missed (today or tomorrow)
  for (const p of insights.predictions.predictions) {
    if (p.probability < config.ai.alertThreshold) continue;
    const code = `${p.timeOfDay}:${p.medicationId}`;
    const exists = await AiAlert.findOne({ patientUserId, code, date: p.nextDueDate });
    if (exists) continue;
    const alert = await AiAlert.create({
      patientUserId,
      kind: "missed_dose_prediction",
      code,
      medicationId: p.medicationId,
      medicineName: p.medicineName,
      timeOfDay: p.timeOfDay,
      date: p.nextDueDate,
      probability: p.probability,
      severity: p.riskLevel,
      title: `${p.medicineName} (${p.timeOfDay}) is at risk of being missed`,
      message: p.reasons.join(" ") || `Predicted miss probability ${Math.round(p.probability * 100)}%.`,
      recommendation: `Plan ahead: keep ${p.medicineName} visible and confirm the ${p.timeOfDay.toLowerCase()} dose as soon as it is taken.`,
    });
    created += 1;

    await notificationService.createNotification({
      userId: patientUserId,
      type: "ai_alert",
      title: `🔮 Heads-up: ${p.medicineName} ${p.timeOfDay.toLowerCase()} dose`,
      message: `Our prediction says there is a ${Math.round(p.probability * 100)}% chance this dose gets missed ${p.nextDueDate === dateKey(new Date()) ? "today" : "tomorrow"}. ${alert.recommendation}`,
      priority: p.probability >= config.ai.caregiverAlertThreshold ? "high" : "normal",
      channel: "all",
      relatedModel: "AiAlert",
      relatedId: alert._id,
      metadata: { probability: p.probability, timeOfDay: p.timeOfDay, medicationId: p.medicationId },
      io,
    });
    alert.notifiedPatient = true;

    if (p.probability >= config.ai.caregiverAlertThreshold && careIds.length) {
      for (const id of careIds) {
        await notificationService.createNotification({
          userId: id,
          type: "ai_alert",
          title: `🔮 ${patient?.firstName || "Patient"} may miss ${p.medicineName} (${p.timeOfDay})`,
          message: `Predicted miss probability ${Math.round(p.probability * 100)}% for ${p.nextDueDate}. ${p.reasons[0] || ""} Consider a check-in around ${SLOT_HOUR[p.timeOfDay]}:00.`,
          priority: "high",
          channel: "all",
          fromUserId: patientUserId,
          relatedModel: "AiAlert",
          relatedId: alert._id,
          io,
        });
      }
      alert.notifiedCareCircle = true;
    }
    await alert.save();
  }

  // b) risk flags (high/critical) once per day
  const today = dateKey(new Date());
  for (const f of insights.risks.flags) {
    if (!["high", "critical"].includes(f.severity)) continue;
    const exists = await AiAlert.findOne({ patientUserId, code: `flag:${f.code}:${f.title}`, date: today });
    if (exists) continue;
    const alert = await AiAlert.create({ patientUserId, kind: "risk_flag", code: `flag:${f.code}:${f.title}`, date: today, severity: f.severity, title: f.title, message: f.detail, recommendation: f.recommendation, outcome: "n/a" });
    created += 1;
    for (const id of careIds) {
      await notificationService.createNotification({
        userId: id,
        type: "ai_alert",
        title: `⚠️ ${patient?.firstName || "Patient"}: ${f.title}`,
        message: `${f.detail} Recommendation: ${f.recommendation}`,
        priority: f.severity === "critical" ? "critical" : "high",
        channel: "all",
        fromUserId: patientUserId,
        relatedModel: "AiAlert",
        relatedId: alert._id,
        io,
      });
    }
    if (f.code !== "drug_interaction" || careIds.length === 0) {
      await notificationService.createNotification({
        userId: patientUserId,
        type: "ai_alert",
        title: `⚠️ ${f.title}`,
        message: `${f.detail} ${f.recommendation}`,
        priority: "high",
        channel: "all",
        relatedModel: "AiAlert",
        relatedId: alert._id,
        io,
      });
      alert.notifiedPatient = true;
    }
    alert.notifiedCareCircle = careIds.length > 0;
    await alert.save();
  }

  return { created, patientUserId };
};

const runPreventiveAlerts = async (io) => {
  const patients = await User.find({ role: "patient", isActive: true }).select("_id");
  let created = 0;
  for (const p of patients) {
    try {
      const r = await runPreventiveAlertsForPatient(p._id, io);
      created += r.created;
    } catch (err) {
      console.error(`AI alert run failed for ${p._id}:`, err.message);
    }
  }
  return { patients: patients.length, created };
};

/** Resolve prediction outcomes once the dose is logged (accuracy tracking). */
const updateAlertOutcomes = async () => {
  const pending = await AiAlert.find({ kind: "missed_dose_prediction", outcome: "pending" });
  let updated = 0;
  for (const a of pending) {
    const day = new Date(a.date + "T00:00:00");
    const log = await AdherenceLog.findOne({ userId: a.patientUserId, medicationId: a.medicationId, timeOfDay: a.timeOfDay, date: day });
    if (log && log.status !== "pending") {
      a.outcome = isDone(log.status) ? "taken" : log.status === "skipped" ? "skipped" : "missed";
      await a.save();
      updated += 1;
    } else if (day < new Date(new Date().setHours(0, 0, 0, 0))) {
      a.outcome = "missed";
      await a.save();
      updated += 1;
    }
  }
  return updated;
};

const getAlerts = async (patientUserId, { limit = 50 } = {}) => AiAlert.find({ patientUserId }).sort({ createdAt: -1 }).limit(Math.min(200, parseInt(limit, 10) || 50));

const getAccuracy = async (patientUserId) => {
  const resolved = await AiAlert.find({ ...(patientUserId ? { patientUserId } : {}), kind: "missed_dose_prediction", outcome: { $in: ["taken", "missed", "skipped"] } });
  const total = resolved.length;
  const hits = resolved.filter((a) => a.outcome !== "taken").length;
  return { predictions: total, confirmedMisses: hits, precision: total ? round2(hits / total) : null };
};

module.exports = { getInsights, runPreventiveAlerts, runPreventiveAlertsForPatient, updateAlertOutcomes, getAlerts, getAccuracy };
