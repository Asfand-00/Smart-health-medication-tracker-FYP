/**
 * MEDICATION PLAN CONTROLLER — medicationPlan.controller.js
 * ===========================================================
 * Plan change requests (FR8/FR9) and treatment templates (FR12).
 */

const MedicationPlanRequest = require("./medicationPlanRequest.model");
const MedicationTemplate = require("./medicationTemplate.model");
const Medication = require("../medication/medication.model");
const Patient = require("../patient/patient.model");
const User = require("../user/user.model");
const notificationService = require("../notification/notification.service");
const audit = require("../audit/audit.service");
const { assertPatientAccess, getCareCircle } = require("../../utils/access");

const handle = (res, next, error) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  next(error);
};
const fullName = (u) => `${u?.firstName || ""} ${u?.lastName || ""}`.trim();

const cleanProposed = (p = {}) => {
  const out = {};
  if (p.medicineName !== undefined) out.medicineName = String(p.medicineName).trim();
  if (p.dosage !== undefined) out.dosage = String(p.dosage).trim();
  if (p.frequency !== undefined && ["daily", "weekly", "custom"].includes(p.frequency)) out.frequency = p.frequency;
  if (Array.isArray(p.timeOfDay)) out.timeOfDay = p.timeOfDay.filter((t) => ["Morning", "Afternoon", "Evening", "Night"].includes(t));
  if (p.startDate) out.startDate = new Date(p.startDate);
  if (p.endDate !== undefined) out.endDate = p.endDate ? new Date(p.endDate) : null;
  if (p.description !== undefined) out.description = String(p.description);
  if (p.notes !== undefined) out.notes = String(p.notes);
  return out;
};

// ── REQUESTS ──────────────────────────────────────────────────────────

// POST /api/medication-plans/requests
// { type: add|update|stop, reviewerId, medicationId?, proposed?, reason, patientUserId? (caregiver) }
exports.createRequest = async (req, res, next) => {
  try {
    const { type, reviewerId, medicationId, proposed, reason } = req.body;
    if (!["add", "update", "stop"].includes(type)) return res.status(400).json({ success: false, message: "type must be add, update or stop." });
    if (!reviewerId) return res.status(400).json({ success: false, message: "reviewerId (caregiver or doctor) is required." });

    const patientUserId = req.user.role === "patient" ? req.user._id.toString() : req.body.patientUserId;
    if (!patientUserId) return res.status(400).json({ success: false, message: "patientUserId is required." });
    await assertPatientAccess(req.user, patientUserId);

    const reviewer = await User.findOne({ _id: reviewerId, role: { $in: ["caregiver", "doctor"] }, isActive: true });
    if (!reviewer) return res.status(404).json({ success: false, message: "Reviewer not found." });
    const circle = await getCareCircle(patientUserId);
    if (![...circle.caregivers, ...circle.doctors].includes(reviewer._id.toString())) {
      return res.status(400).json({ success: false, message: "The reviewer must be a caregiver or doctor linked to this patient." });
    }

    let snapshot = null;
    if (type !== "add") {
      const med = await Medication.findOne({ _id: medicationId, userId: patientUserId });
      if (!med) return res.status(404).json({ success: false, message: "Medication not found." });
      snapshot = { medicineName: med.medicineName, dosage: med.dosage, frequency: med.frequency, timeOfDay: med.timeOfDay, startDate: med.startDate, endDate: med.endDate, description: med.description, notes: med.notes };
    }
    const cleaned = cleanProposed(proposed || {});
    if (type === "add" && (!cleaned.medicineName || !cleaned.dosage || !cleaned.timeOfDay?.length)) {
      return res.status(400).json({ success: false, message: "proposed.medicineName, dosage and timeOfDay are required for a new medication." });
    }
    if (type === "update" && Object.keys(cleaned).length === 0) {
      return res.status(400).json({ success: false, message: "proposed changes are required for an update." });
    }

    const request = await MedicationPlanRequest.create({
      patientUserId,
      requestedBy: req.user._id,
      requestedByRole: req.user.role,
      reviewerId: reviewer._id,
      reviewerRole: reviewer.role,
      type,
      medicationId: type !== "add" ? medicationId : null,
      medicationSnapshot: snapshot,
      proposed: type !== "stop" ? cleaned : null,
      reason: reason || "",
    });

    const patientUser = await User.findById(patientUserId).select("firstName lastName");
    const label = type === "add" ? `add ${cleaned.medicineName}` : type === "update" ? `change ${snapshot.medicineName}` : `stop ${snapshot.medicineName}`;
    await notificationService.createNotification({
      userId: reviewer._id,
      type: "plan_request",
      title: `📝 Plan approval needed for ${fullName(patientUser)}`,
      message: `${fullName(req.user)} asks to ${label}.${reason ? ` Reason: ${reason}` : ""}`,
      priority: "normal",
      channel: "both",
      fromUserId: req.user._id,
      relatedModel: "MedicationPlanRequest",
      relatedId: request._id,
      io: req.app.locals.io,
    });
    await audit.record(req, { action: "plan.request_created", category: "medication", entityType: "MedicationPlanRequest", entityId: request._id, targetUserId: patientUserId });

    res.status(201).json({ success: true, message: "Request sent for approval.", data: request });
  } catch (error) {
    handle(res, next, error);
  }
};

// GET /api/medication-plans/requests?patientId=&status=  (requester view)
exports.listMine = async (req, res, next) => {
  try {
    const query = {};
    if (req.user.role === "patient") query.patientUserId = req.user._id;
    else if (req.query.patientId) {
      await assertPatientAccess(req.user, req.query.patientId);
      query.patientUserId = req.query.patientId;
    } else query.$or = [{ requestedBy: req.user._id }, { reviewerId: req.user._id }];
    if (req.query.status) query.status = req.query.status;
    const requests = await MedicationPlanRequest.find(query).populate("reviewerId", "firstName lastName role").populate("requestedBy", "firstName lastName role").populate("patientUserId", "firstName lastName").sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    handle(res, next, error);
  }
};

// GET /api/medication-plans/pending  (reviewer view)
exports.listPending = async (req, res, next) => {
  try {
    const status = req.query.status || "pending";
    const requests = await MedicationPlanRequest.find({ reviewerId: req.user._id, ...(status === "all" ? {} : { status }) }).populate("requestedBy", "firstName lastName role").populate("patientUserId", "firstName lastName").sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
};

// POST /api/medication-plans/requests/:id/review  { status: approved|rejected, note }
exports.review = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    if (!["approved", "rejected"].includes(status)) return res.status(400).json({ success: false, message: "status must be approved or rejected." });
    const request = await MedicationPlanRequest.findOne({ _id: req.params.id, reviewerId: req.user._id, status: "pending" });
    if (!request) return res.status(404).json({ success: false, message: "Pending request not found." });

    const patientUserId = request.patientUserId.toString();
    if (status === "approved") {
      const profile = await Patient.findOne({ userId: patientUserId });
      if (!profile) return res.status(400).json({ success: false, message: "The patient has no medical profile yet." });
      if (request.type === "add") {
        const med = await Medication.create({ ...request.proposed.toObject(), startDate: request.proposed.startDate || new Date(), userId: patientUserId, patientId: profile._id, addedBy: request.requestedBy, addedByRole: request.requestedByRole });
        request.resultMedicationId = med._id;
      } else if (request.type === "update") {
        const med = await Medication.findOneAndUpdate({ _id: request.medicationId, userId: patientUserId }, { $set: request.proposed.toObject() }, { new: true, runValidators: true });
        if (!med) return res.status(404).json({ success: false, message: "The medication no longer exists." });
        request.resultMedicationId = med._id;
      } else if (request.type === "stop") {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const med = await Medication.findOneAndUpdate({ _id: request.medicationId, userId: patientUserId }, { $set: { endDate: yesterday } }, { new: true });
        if (!med) return res.status(404).json({ success: false, message: "The medication no longer exists." });
        request.resultMedicationId = med._id;
      }
      if (req.app.locals.io) req.app.locals.io.to(patientUserId).emit("medication_updated");
    }

    request.status = status;
    request.reviewNote = note || "";
    request.reviewedAt = new Date();
    await request.save();

    const name = request.proposed?.medicineName || request.medicationSnapshot?.medicineName || "medication";
    const targets = new Set([patientUserId, request.requestedBy.toString()]);
    for (const userId of targets) {
      await notificationService.createNotification({
        userId,
        type: "plan_request",
        title: status === "approved" ? `✅ Plan change approved: ${name}` : `❌ Plan change rejected: ${name}`,
        message: `${fullName(req.user)} ${status} the request to ${request.type} ${name}.${note ? ` Note: ${note}` : ""}`,
        priority: "normal",
        channel: "both",
        fromUserId: req.user._id,
        relatedModel: "MedicationPlanRequest",
        relatedId: request._id,
        io: req.app.locals.io,
      });
    }
    await audit.record(req, { action: `plan.request_${status}`, category: "medication", entityType: "MedicationPlanRequest", entityId: request._id, targetUserId: patientUserId });

    res.status(200).json({ success: true, message: `Request ${status}.`, data: request });
  } catch (error) {
    handle(res, next, error);
  }
};

// DELETE /api/medication-plans/requests/:id — requester cancels
exports.cancel = async (req, res, next) => {
  try {
    const request = await MedicationPlanRequest.findOneAndUpdate({ _id: req.params.id, requestedBy: req.user._id, status: "pending" }, { status: "cancelled", reviewedAt: new Date() }, { new: true });
    if (!request) return res.status(404).json({ success: false, message: "Pending request not found." });
    res.status(200).json({ success: true, message: "Request cancelled.", data: request });
  } catch (error) {
    next(error);
  }
};

// ── TEMPLATES ─────────────────────────────────────────────────────────

// GET /api/medication-templates
exports.listTemplates = async (req, res, next) => {
  try {
    const query = { $or: [{ isGlobal: true }, { createdBy: req.user._id }] };
    if (req.query.category) query.category = req.query.category;
    const templates = await MedicationTemplate.find(query).sort({ isGlobal: -1, usageCount: -1, name: 1 });
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
};

// POST /api/medication-templates
exports.createTemplate = async (req, res, next) => {
  try {
    const { name, description, category, items, isGlobal } = req.body;
    if (!name || !Array.isArray(items) || items.length === 0) return res.status(400).json({ success: false, message: "name and at least one item are required." });
    const template = await MedicationTemplate.create({
      name,
      description: description || "",
      category: category || "General",
      items,
      isGlobal: Boolean(isGlobal) && ["admin", "doctor"].includes(req.user.role),
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, message: "Template saved.", data: template });
  } catch (error) {
    next(error);
  }
};

// PUT /api/medication-templates/:id
exports.updateTemplate = async (req, res, next) => {
  try {
    const query = req.user.role === "admin" ? { _id: req.params.id } : { _id: req.params.id, createdBy: req.user._id };
    const template = await MedicationTemplate.findOne(query);
    if (!template) return res.status(404).json({ success: false, message: "Template not found." });
    ["name", "description", "category", "items"].forEach((f) => {
      if (req.body[f] !== undefined) template[f] = req.body[f];
    });
    if (req.body.isGlobal !== undefined && ["admin", "doctor"].includes(req.user.role)) template.isGlobal = Boolean(req.body.isGlobal);
    await template.save();
    res.status(200).json({ success: true, message: "Template updated.", data: template });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/medication-templates/:id
exports.deleteTemplate = async (req, res, next) => {
  try {
    const query = req.user.role === "admin" ? { _id: req.params.id } : { _id: req.params.id, createdBy: req.user._id };
    const result = await MedicationTemplate.deleteOne(query);
    if (result.deletedCount === 0) return res.status(404).json({ success: false, message: "Template not found." });
    res.status(200).json({ success: true, message: "Template deleted." });
  } catch (error) {
    next(error);
  }
};

// POST /api/medication-templates/:id/apply  { patientUserId? (caregiver/doctor), itemIds? }
exports.applyTemplate = async (req, res, next) => {
  try {
    const template = await MedicationTemplate.findOne({ _id: req.params.id, $or: [{ isGlobal: true }, { createdBy: req.user._id }] });
    if (!template) return res.status(404).json({ success: false, message: "Template not found." });
    const patientUserId = req.user.role === "patient" ? req.user._id.toString() : req.body.patientUserId;
    if (!patientUserId) return res.status(400).json({ success: false, message: "patientUserId is required." });
    const profile = await assertPatientAccess(req.user, patientUserId);
    if (!profile) return res.status(400).json({ success: false, message: "The patient has not completed their medical profile yet." });

    const items = Array.isArray(req.body.itemIds) && req.body.itemIds.length ? template.items.filter((i) => req.body.itemIds.includes(i._id.toString())) : template.items;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const created = [];
    for (const item of items) {
      const exists = await Medication.findOne({ userId: patientUserId, medicineName: new RegExp(`^${item.medicineName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), $or: [{ endDate: null }, { endDate: { $gte: start } }] });
      if (exists) continue;
      created.push(
        await Medication.create({
          userId: patientUserId,
          patientId: profile._id,
          medicineName: item.medicineName,
          dosage: item.dosage,
          frequency: item.frequency,
          timeOfDay: item.timeOfDay,
          startDate: start,
          endDate: item.durationDays ? new Date(start.getTime() + (item.durationDays - 1) * 86400000) : null,
          description: `From template "${template.name}"`,
          notes: item.notes || "",
          templateId: template._id,
          addedBy: req.user._id,
          addedByRole: req.user.role,
        })
      );
    }
    template.usageCount += 1;
    await template.save();
    if (req.app.locals.io) req.app.locals.io.to(patientUserId).emit("medication_updated");
    await audit.record(req, { action: "template.applied", category: "medication", entityType: "MedicationTemplate", entityId: template._id, targetUserId: patientUserId, metadata: { created: created.length } });
    res.status(200).json({ success: true, message: `${created.length} medication(s) added from "${template.name}".`, data: { created, skipped: items.length - created.length } });
  } catch (error) {
    handle(res, next, error);
  }
};

/** Seed a few well-known regimens so the feature is usable on a fresh database. */
exports.seedTemplates = async () => {
  const count = await MedicationTemplate.countDocuments({ isGlobal: true });
  if (count > 0) return;
  await MedicationTemplate.insertMany([
    {
      name: "Alzheimer's — Donepezil starter",
      description: "Typical starting regimen for mild-to-moderate Alzheimer's disease. Confirm dosing with the treating physician.",
      category: "Alzheimer's",
      isGlobal: true,
      items: [{ medicineName: "Donepezil", dosage: "5mg", frequency: "daily", timeOfDay: ["Night"], durationDays: null, notes: "Take at bedtime. Dose may be increased to 10mg after 4–6 weeks." }],
    },
    {
      name: "Alzheimer's — Donepezil + Memantine",
      description: "Combination therapy for moderate-to-severe Alzheimer's disease.",
      category: "Alzheimer's",
      isGlobal: true,
      items: [
        { medicineName: "Donepezil", dosage: "10mg", frequency: "daily", timeOfDay: ["Night"], notes: "At bedtime" },
        { medicineName: "Memantine", dosage: "10mg", frequency: "daily", timeOfDay: ["Morning", "Evening"], notes: "With or without food" },
      ],
    },
    {
      name: "Hypertension — basic",
      description: "Common first-line blood pressure control.",
      category: "Cardiovascular",
      isGlobal: true,
      items: [
        { medicineName: "Amlodipine", dosage: "5mg", frequency: "daily", timeOfDay: ["Morning"] },
        { medicineName: "Losartan", dosage: "50mg", frequency: "daily", timeOfDay: ["Morning"] },
      ],
    },
    {
      name: "Type 2 Diabetes — Metformin",
      description: "Metformin twice daily with meals.",
      category: "Diabetes",
      isGlobal: true,
      items: [{ medicineName: "Metformin", dosage: "500mg", frequency: "daily", timeOfDay: ["Morning", "Night"], notes: "Take with meals to reduce stomach upset." }],
    },
    {
      name: "Cardio-protection",
      description: "Low-dose aspirin and a statin.",
      category: "Cardiovascular",
      isGlobal: true,
      items: [
        { medicineName: "Aspirin", dosage: "75mg", frequency: "daily", timeOfDay: ["Morning"], notes: "After breakfast" },
        { medicineName: "Atorvastatin", dosage: "20mg", frequency: "daily", timeOfDay: ["Night"] },
      ],
    },
    {
      name: "Vitamin supplementation",
      description: "Daily vitamin D and B12 support, common in older adults.",
      category: "Supplements",
      isGlobal: true,
      items: [
        { medicineName: "Vitamin D3", dosage: "1000 IU", frequency: "daily", timeOfDay: ["Morning"] },
        { medicineName: "Vitamin B12", dosage: "500mcg", frequency: "daily", timeOfDay: ["Morning"] },
      ],
    },
  ]);
  console.log("🧩 Seeded global medication templates.");
};
