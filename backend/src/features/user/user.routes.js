/**
 * USER ROUTES — user.routes.js
 * ==============================
 * GET    /api/user/profile   → my profile
 * PUT    /api/user/profile   → update my profile
 * PUT    /api/user/recovery  → recovery email / phone
 * GET    /api/user/export    → export my data (privacy)
 * DELETE /api/user/me        → delete my account (needs password)
 * POST   /api/user/consent   → record privacy consent
 * GET    /api/user/all       → all active users (admin)
 * PUT    /api/user/:id       → admin update
 * DELETE /api/user/:id       → admin delete
 */

const express = require("express");
const router = express.Router();

const {
  getProfile,
  updateProfile,
  updateRecovery,
  exportData,
  deleteMe,
  consent,
  getAllUsers,
  adminUpdateUser,
  adminDeleteUser,
} = require("./user.controller");
const { protect } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/roleMiddleware");

router.use(protect);

router.route("/profile").get(getProfile).put(updateProfile);
router.put("/recovery", updateRecovery);
router.get("/export", exportData);
router.delete("/me", deleteMe);
router.post("/consent", consent);

// Admin only routes
router.get("/all", authorize("admin"), getAllUsers);
router.route("/:id").put(authorize("admin"), adminUpdateUser).delete(authorize("admin"), adminDeleteUser);

module.exports = router;
