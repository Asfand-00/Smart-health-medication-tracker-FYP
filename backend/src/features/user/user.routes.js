/**
 * USER ROUTES — user.routes.js
 * ==============================
 * All routes here require authentication (protect middleware).
 * Some also require specific roles (authorize middleware).
 *
 * ROUTES:
 * GET  /api/user/profile  → get my profile (any logged-in user)
 * PUT  /api/user/profile  → update my profile (any logged-in user)
 * GET  /api/user/all      → get all users (admin only)
 */

const express = require("express");
const router = express.Router();

const { getProfile, updateProfile, getAllUsers, adminUpdateUser, adminDeleteUser } = require("./user.controller");
const { protect } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/roleMiddleware");

// All routes in this file require authentication
// apply protect middleware to all routes at once using router.use()
router.use(protect);

// GET  /api/user/profile
// PUT  /api/user/profile
router.route("/profile")
  .get(getProfile)
  .put(updateProfile);

// Admin only routes
router.get("/all", authorize("admin"), getAllUsers);
router.route("/:id")
  .put(authorize("admin"), adminUpdateUser)
  .delete(authorize("admin"), adminDeleteUser);

module.exports = router;
