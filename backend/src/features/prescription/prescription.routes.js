/**
 * PRESCRIPTION ROUTES — prescription.routes.js
 * ==============================================
 * POST   /api/prescriptions               upload (multipart "file" + fields) or JSON
 * GET    /api/prescriptions               list (patient: own · caregiver/doctor: ?patientId or all assigned)
 * POST   /api/prescriptions/parse-text    preview text → medication plan
 * GET    /api/prescriptions/:id
 * PUT    /api/prescriptions/:id
 * GET    /api/prescriptions/:id/file      decrypted document (inline / ?download=true)
 * GET    /api/prescriptions/:id/history
 * POST   /api/prescriptions/:id/parse     regenerate plan from rawText
 * POST   /api/prescriptions/:id/verify    doctor: verified | rejected
 * POST   /api/prescriptions/:id/apply     create medications from the plan
 * DELETE /api/prescriptions/:id           archive (?restore=true to undo)
 */

const express = require("express");
const multer = require("multer");
const { protect } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/roleMiddleware");
const c = require("./prescription.controller");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});

const router = express.Router();
router.use(protect);

router.post("/parse-text", c.parseText);
router.route("/").get(c.list).post(upload.single("file"), c.create);
router.get("/:id/file", c.getFile);
router.get("/:id/history", c.history);
router.post("/:id/parse", c.parse);
router.post("/:id/verify", authorize("doctor", "admin"), c.verify);
router.post("/:id/apply", c.apply);
router.route("/:id").get(c.getOne).put(c.update).delete(c.archive);

module.exports = router;
