/**
 * PRESCRIPTION CONTROLLER — prescription.controller.js
 * ======================================================
 * Upload (with optional encrypted file), list, view, update, verify,
 * history, parse text → medication plan, apply plan to the patient's
 * medications, archive.
 */

const fs = require("fs");
const path = require("path");
const Prescription = require("./prescription.model");
const Medication = require("../medication/medication.model");
const Patient = require("../patient/patient.model");
const User = require("../user/user.model");
const SystemConfig = require("../admin/systemConfig.model");
const notificationService = require("../notification/notification.service");
const audit = require("../audit/audit.service");
const { assertPatientAccess, getCareCircle } = require("../../utils/access");
const { encryptBuffer, decryptBuffer, sha256 } = require("../../utils/crypto");
const { parsePrescriptionText } = require("./prescriptionParser");

const UPLOAD_DIR = path.join(__dirname, "../../../uploads/prescriptions");
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

const handle = (res, next, error) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  next(error);
};

const fullName = (u) => `${u?.firstName || ""} ${u?.lastName || ""}`.trim();

const parseMedications = (value) => {
  if (!value) return [];
  let list = value;
  if (typeof value === "string") {
    try {
      list = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .filter((m) => m && m.medicineName)
    .map((m) => ({
      medicineName: String(m.medicineName).trim(),
      dosage: String(m.dosage || "").trim(),
      frequency: ["daily", "weekly", "custom"].includes(m.frequency) ? m.frequency : "daily",
      timeOfDay: Array.isArray(m.timeOfDay) && m.timeOfDay.length ? m.timeOfDay.filter((t) => ["Morning", "Afternoon", "Evening", "Night"].includes(t)) : ["Morning"],
      durationDays: m.durationDays ? Number(m.durationDays) : null,
      instructions: String(m.instructions || "").trim(),
      sourceLine: String(m.sourceLine || "").trim(),
      confidence: typeof m.confidence === "number" ? m.confidence : 1,
    }));
};

/** Resolve which patient a request is about and check access. */
const resolvePatient = async (req) => {
  const patientUserId = req.user.role === "patient" ? req.user._id : req.body.patientUserId || req.query.patientId;
  if (!patientUserId) throw { status: 400, message: "patientUserId is required." };
  await assertPatientAccess(req.user, patientUserId);
  return patientUserId.toString();
};

const notifyCircle = async (req, patientUserId, { title, message, excludeId, relatedId, includePatient = false, priority = "normal" }) => {
  const circle = await getCareCircle(patientUserId);
  const targets = new Set([...circle.caregivers, ...circle.doctors]);
  if (includePatient) targets.add(patientUserId.toString());
  if (excludeId) targets.delete(excludeId.toString());
  for (const userId of targets) {
    await notificationService.createNotification({
      userId,
      type: "prescription",
      title,
      message,
      priority,
      channel: "both",
      fromUserId: req.user._id,
      relatedModel: "Prescription",
      relatedId,
      io: req.app.locals.io,
    });
  }
};

// POST /api/prescriptions  (multipart or JSON)
exports.create = async (req, res, next) => {
  try {
    const patientUserId = await resolvePatient(req);
    const config = await SystemConfig.getConfig();
    const { title, doctorName, issuedDate, expiryDate, diagnosis, notes, rawText } = req.body;
    if (!title || !String(title).trim()) return res.status(400).json({ success: false, message: "Title is required." });

    let medications = parseMedications(req.body.medications);
    if (medications.length === 0 && rawText) {
      medications = parsePrescriptionText(rawText).medications;
    }

    const isDoctor = req.user.role === "doctor";
    const doc = new Prescription({
      patientUserId,
      uploadedBy: req.user._id,
      uploadedByRole: req.user.role,
      doctorId: isDoctor ? req.user._id : null,
      doctorName: isDoctor ? `Dr. ${fullName(req.user)}` : doctorName || "",
      title: String(title).trim(),
      issuedDate: issuedDate ? new Date(issuedDate) : new Date(),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      diagnosis: diagnosis || "",
      notes: notes || "",
      rawText: rawText || "",
      medications,
      // A prescription written by a doctor in the system is verified by definition.
      status: isDoctor || !config.prescriptions.requireDoctorVerification ? "verified" : "pending",
      verifiedBy: isDoctor ? req.user._id : null,
      verifiedAt: isDoctor ? new Date() : null,
      history: [{ action: "created", byUserId: req.user._id, byRole: req.user.role, note: req.file ? `Uploaded ${req.file.originalname}` : "Created without a document" }],
    });

    if (req.file) {
      if (!ALLOWED_MIME.includes(req.file.mimetype)) {
        return res.status(400).json({ success: false, message: "Only JPG, PNG, WEBP, HEIC images or PDF documents are allowed." });
      }
      const maxBytes = (config.prescriptions.maxFileSizeMb || 10) * 1024 * 1024;
      if (req.file.size > maxBytes) {
        return res.status(400).json({ success: false, message: `File is too large (max ${config.prescriptions.maxFileSizeMb} MB).` });
      }
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      const storagePath = path.join(UPLOAD_DIR, `${doc._id}.enc`);
      fs.writeFileSync(storagePath, encryptBuffer(req.file.buffer));
      doc.file = {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        storagePath,
        checksum: sha256(req.file.buffer),
        encrypted: true,
      };
    }

    await doc.save();
    if (isDoctor) {
      doc.history.push({ action: "verified", byUserId: req.user._id, byRole: "doctor", note: "Issued by doctor" });
      await doc.save();
    }

    await audit.record(req, { action: "prescription.upload", category: "prescription", entityType: "Prescription", entityId: doc._id, targetUserId: patientUserId, details: req.file ? `file ${req.file.mimetype} ${req.file.size}B` : "no file" });

    const patientUser = await User.findById(patientUserId).select("firstName lastName");
    await notifyCircle(req, patientUserId, {
      title: isDoctor ? `📄 New prescription for ${fullName(patientUser)}` : `📄 ${fullName(req.user)} uploaded a prescription`,
      message: `${doc.title}${doc.medications.length ? ` · ${doc.medications.length} medication(s)` : ""}${doc.status === "pending" ? " · awaiting doctor verification" : ""}`,
      excludeId: req.user._id,
      relatedId: doc._id,
      includePatient: req.user._id.toString() !== patientUserId,
    });

    const out = doc.toObject();
    delete out.file?.storagePath;
    res.status(201).json({ success: true, message: "Prescription saved.", data: out });
  } catch (error) {
    handle(res, next, error);
  }
};

// GET /api/prescriptions?patientId=&status=
exports.list = async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role === "patient") {
      query.patientUserId = req.user._id;
    } else if (req.query.patientId) {
      await assertPatientAccess(req.user, req.query.patientId);
      query.patientUserId = req.query.patientId;
    } else if (req.user.role === "doctor") {
      // all prescriptions of the doctor's assigned patients (+ those they issued)
      const DoctorPatientLink = require("../doctor/doctorPatientLink.model");
      const links = await DoctorPatientLink.find({ doctorId: req.user._id, status: "accepted" }).select("patientUserId");
      query = { $or: [{ patientUserId: { $in: links.map((l) => l.patientUserId) } }, { doctorId: req.user._id }] };
    } else if (req.user.role === "caregiver") {
      const patients = await Patient.find({ assignedCaregivers: req.user._id }).select("userId");
      query.patientUserId = { $in: patients.map((p) => p.userId) };
    }
    if (req.query.status) query.status = req.query.status;
    query.isArchived = req.query.archived === "true";

    const prescriptions = await Prescription.find(query)
      .populate("patientUserId", "firstName lastName")
      .populate("uploadedBy", "firstName lastName role")
      .populate("verifiedBy", "firstName lastName")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: prescriptions });
  } catch (error) {
    handle(res, next, error);
  }
};

const loadWithAccess = async (req, id) => {
  const doc = await Prescription.findById(id).select("+file.storagePath").populate("uploadedBy", "firstName lastName role").populate("verifiedBy", "firstName lastName").populate("patientUserId", "firstName lastName");
  if (!doc) throw { status: 404, message: "Prescription not found." };
  await assertPatientAccess(req.user, doc.patientUserId._id || doc.patientUserId);
  return doc;
};

// GET /api/prescriptions/:id
exports.getOne = async (req, res, next) => {
  try {
    const doc = await loadWithAccess(req, req.params.id);
    const out = doc.toObject();
    delete out.file?.storagePath;
    res.status(200).json({ success: true, data: out });
  } catch (error) {
    handle(res, next, error);
  }
};

// GET /api/prescriptions/:id/file  — decrypts and streams the document
exports.getFile = async (req, res, next) => {
  try {
    const doc = await loadWithAccess(req, req.params.id);
    if (!doc.file?.storagePath || !fs.existsSync(doc.file.storagePath)) {
      return res.status(404).json({ success: false, message: "No document attached to this prescription." });
    }
    const plain = decryptBuffer(fs.readFileSync(doc.file.storagePath));
    await audit.record(req, { action: "prescription.file_viewed", category: "prescription", entityType: "Prescription", entityId: doc._id });
    res.setHeader("Content-Type", doc.file.mimeType || "application/octet-stream");
    res.setHeader("Content-Length", plain.length);
    res.setHeader("Content-Disposition", `${req.query.download === "true" ? "attachment" : "inline"}; filename="${(doc.file.originalName || "prescription").replace(/"/g, "")}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.status(200).end(plain);
  } catch (error) {
    handle(res, next, error);
  }
};

// PUT /api/prescriptions/:id
exports.update = async (req, res, next) => {
  try {
    const doc = await loadWithAccess(req, req.params.id);
    const editable = ["title", "doctorName", "issuedDate", "expiryDate", "diagnosis", "notes", "rawText"];
    const changed = [];
    editable.forEach((f) => {
      if (req.body[f] !== undefined && String(req.body[f]) !== String(doc[f] ?? "")) {
        doc[f] = f.endsWith("Date") ? (req.body[f] ? new Date(req.body[f]) : null) : req.body[f];
        changed.push(f);
      }
    });
    if (req.body.medications !== undefined) {
      doc.medications = parseMedications(req.body.medications);
      changed.push("medications");
    }
    if (changed.length === 0) return res.status(400).json({ success: false, message: "Nothing to update." });

    // Edits by non-doctors invalidate a previous verification
    if (req.user.role !== "doctor" && doc.status === "verified" && changed.includes("medications")) {
      doc.status = "pending";
      doc.verifiedBy = null;
      doc.verifiedAt = null;
      doc.verificationNote = "";
      doc.history.push({ action: "verification_reset", byUserId: req.user._id, byRole: req.user.role, note: "Medication list changed after verification" });
    }
    doc.history.push({ action: "updated", byUserId: req.user._id, byRole: req.user.role, note: `Changed: ${changed.join(", ")}` });
    await doc.save();

    const out = doc.toObject();
    delete out.file?.storagePath;
    res.status(200).json({ success: true, message: "Prescription updated.", data: out });
  } catch (error) {
    handle(res, next, error);
  }
};

// POST /api/prescriptions/:id/verify  { status: verified|rejected, note }
exports.verify = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    if (!["verified", "rejected"].includes(status)) return res.status(400).json({ success: false, message: "status must be verified or rejected." });
    const doc = await loadWithAccess(req, req.params.id);

    doc.status = status;
    doc.verifiedBy = req.user._id;
    doc.verifiedAt = new Date();
    doc.verificationNote = note || "";
    if (!doc.doctorId) doc.doctorId = req.user._id;
    doc.history.push({ action: status, byUserId: req.user._id, byRole: req.user.role, note: note || "" });
    await doc.save();

    await audit.record(req, { action: `prescription.${status}`, category: "prescription", entityType: "Prescription", entityId: doc._id, targetUserId: doc.patientUserId._id });
    await notifyCircle(req, doc.patientUserId._id, {
      title: status === "verified" ? `✅ Prescription verified: ${doc.title}` : `❌ Prescription rejected: ${doc.title}`,
      message: status === "verified" ? `Dr. ${fullName(req.user)} verified this prescription.${note ? ` Note: ${note}` : ""} You can now apply it to the medication schedule.` : `Dr. ${fullName(req.user)} rejected this prescription.${note ? ` Reason: ${note}` : ""}`,
      excludeId: req.user._id,
      relatedId: doc._id,
      includePatient: true,
      priority: status === "rejected" ? "high" : "normal",
    });

    const out = doc.toObject();
    delete out.file?.storagePath;
    res.status(200).json({ success: true, message: `Prescription ${status}.`, data: out });
  } catch (error) {
    handle(res, next, error);
  }
};

// GET /api/prescriptions/:id/history
exports.history = async (req, res, next) => {
  try {
    const doc = await loadWithAccess(req, req.params.id);
    const User = require("../user/user.model");
    const ids = [...new Set(doc.history.map((h) => h.byUserId?.toString()).filter(Boolean))];
    const users = await User.find({ _id: { $in: ids } }).select("firstName lastName role");
    const byId = Object.fromEntries(users.map((u) => [u._id.toString(), { firstName: u.firstName, lastName: u.lastName, role: u.role }]));
    const history = doc.history.map((h) => ({ action: h.action, at: h.at, note: h.note, byRole: h.byRole, by: byId[h.byUserId?.toString()] || null }));
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    handle(res, next, error);
  }
};

// POST /api/prescriptions/parse-text  { text }  — preview without saving
exports.parseText = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || !String(text).trim()) return res.status(400).json({ success: false, message: "text is required." });
    const result = parsePrescriptionText(text);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// POST /api/prescriptions/:id/parse — (re)generate the medication list from rawText
exports.parse = async (req, res, next) => {
  try {
    const doc = await loadWithAccess(req, req.params.id);
    const text = req.body.text || doc.rawText;
    if (!text) return res.status(400).json({ success: false, message: "This prescription has no text to parse." });
    const result = parsePrescriptionText(text);
    if (req.body.text) doc.rawText = req.body.text;
    doc.medications = result.medications;
    doc.history.push({ action: "parsed", byUserId: req.user._id, byRole: req.user.role, note: `${result.medications.length} medication(s) extracted from text` });
    await doc.save();
    const out = doc.toObject();
    delete out.file?.storagePath;
    res.status(200).json({ success: true, message: `${result.medications.length} medication(s) extracted.`, data: { prescription: out, unparsed: result.unparsed } });
  } catch (error) {
    handle(res, next, error);
  }
};

// POST /api/prescriptions/:id/apply — create Medication records from the plan
exports.apply = async (req, res, next) => {
  try {
    const doc = await loadWithAccess(req, req.params.id);
    const config = await SystemConfig.getConfig();
    const patientUserId = (doc.patientUserId._id || doc.patientUserId).toString();

    if (doc.medications.length === 0) return res.status(400).json({ success: false, message: "This prescription lists no medications. Parse the text or add them first." });
    if (config.prescriptions.requireDoctorVerification && doc.status !== "verified" && req.user.role !== "doctor") {
      return res.status(400).json({ success: false, message: "This prescription must be verified by a doctor before it is applied to the schedule." });
    }
    const profile = await Patient.findOne({ userId: patientUserId });
    if (!profile) return res.status(400).json({ success: false, message: "The patient has not completed their medical profile yet." });

    const selected = Array.isArray(req.body.medicationIds) && req.body.medicationIds.length ? doc.medications.filter((m) => req.body.medicationIds.includes(m._id.toString())) : doc.medications;
    const created = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (const m of selected) {
      const endDate = m.durationDays ? new Date(start.getTime() + (m.durationDays - 1) * 86400000) : null;
      const existing = await Medication.findOne({ userId: patientUserId, medicineName: new RegExp(`^${m.medicineName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), prescriptionId: doc._id });
      if (existing) continue;
      const med = await Medication.create({
        userId: patientUserId,
        patientId: profile._id,
        medicineName: m.medicineName,
        dosage: m.dosage || "as directed",
        frequency: m.frequency,
        timeOfDay: m.timeOfDay.length ? m.timeOfDay : ["Morning"],
        startDate: start,
        endDate,
        description: doc.diagnosis ? `Prescribed for ${doc.diagnosis}` : `From prescription "${doc.title}"`,
        notes: m.instructions || doc.notes || "",
        prescriptionId: doc._id,
        addedBy: req.user._id,
        addedByRole: req.user.role,
      });
      created.push(med);
    }

    if (req.user.role === "doctor" && doc.status !== "verified") {
      doc.status = "verified";
      doc.verifiedBy = req.user._id;
      doc.verifiedAt = new Date();
      doc.history.push({ action: "verified", byUserId: req.user._id, byRole: "doctor", note: "Verified while applying" });
    }
    doc.appliedAt = new Date();
    doc.appliedMedicationIds.push(...created.map((m) => m._id));
    doc.history.push({ action: "applied", byUserId: req.user._id, byRole: req.user.role, note: `${created.length} medication(s) added to the schedule` });
    await doc.save();

    await audit.record(req, { action: "prescription.applied", category: "medication", entityType: "Prescription", entityId: doc._id, targetUserId: patientUserId, metadata: { created: created.length } });
    if (req.app.locals.io) req.app.locals.io.to(patientUserId).emit("medication_updated");
    await notifyCircle(req, patientUserId, {
      title: `💊 Medication plan updated from "${doc.title}"`,
      message: created.length ? `${created.map((m) => `${m.medicineName} ${m.dosage}`).join(", ")} added to the schedule.` : "All medications from this prescription were already on the schedule.",
      excludeId: req.user._id,
      relatedId: doc._id,
      includePatient: true,
    });

    res.status(200).json({ success: true, message: `${created.length} medication(s) added to the schedule.`, data: { created, skipped: selected.length - created.length } });
  } catch (error) {
    handle(res, next, error);
  }
};

// DELETE /api/prescriptions/:id — archive (soft delete), keeps history
exports.archive = async (req, res, next) => {
  try {
    const doc = await loadWithAccess(req, req.params.id);
    doc.isArchived = !(req.query.restore === "true");
    doc.history.push({ action: doc.isArchived ? "archived" : "restored", byUserId: req.user._id, byRole: req.user.role });
    await doc.save();
    await audit.record(req, { action: doc.isArchived ? "prescription.archived" : "prescription.restored", category: "prescription", entityType: "Prescription", entityId: doc._id });
    res.status(200).json({ success: true, message: doc.isArchived ? "Prescription archived." : "Prescription restored." });
  } catch (error) {
    handle(res, next, error);
  }
};
