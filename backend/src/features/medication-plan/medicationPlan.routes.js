/**
 * MEDICATION PLAN ROUTES — medicationPlan.routes.js
 * ===================================================
 * /api/medication-plans
 *   POST   /requests              patient/caregiver proposes add|update|stop
 *   GET    /requests              my requests (?patientId for caregiver/doctor)
 *   GET    /pending               requests waiting for me (caregiver/doctor)
 *   POST   /requests/:id/review   approve | reject
 *   DELETE /requests/:id          cancel my pending request
 * /api/medication-templates
 *   GET / · POST / · PUT /:id · DELETE /:id · POST /:id/apply
 */

const express = require("express");
const { protect } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/roleMiddleware");
const c = require("./medicationPlan.controller");

const plans = express.Router();
plans.use(protect);
plans.post("/requests", authorize("patient", "caregiver"), c.createRequest);
plans.get("/requests", c.listMine);
plans.get("/pending", authorize("caregiver", "doctor"), c.listPending);
plans.post("/requests/:id/review", authorize("caregiver", "doctor"), c.review);
plans.delete("/requests/:id", authorize("patient", "caregiver"), c.cancel);

const templates = express.Router();
templates.use(protect);
templates.get("/", c.listTemplates);
templates.post("/", c.createTemplate);
templates.put("/:id", c.updateTemplate);
templates.delete("/:id", c.deleteTemplate);
templates.post("/:id/apply", authorize("patient", "caregiver", "doctor"), c.applyTemplate);

module.exports = { plans, templates };
