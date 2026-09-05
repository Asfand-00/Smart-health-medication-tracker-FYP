/**
 * USER CONTROLLER — user.controller.js
 * =======================================
 * Handles HTTP requests for user profile operations.
 */

const { validationResult } = require("express-validator");
const userService = require("./user.service");

// GET /api/user/profile — get current user's profile
const getProfile = async (req, res, next) => {
  try {
    // req.user.id is set by the protect middleware
    const user = await userService.getUserProfile(req.user.id);
    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/user/profile — update current user's profile
const updateProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        message: "Validation failed",
        errors: errors.array().map((err) => ({ field: err.path, message: err.msg })),
      });
    }

    const updatedUser = await userService.updateUserProfile(req.user.id, req.body);
    res.status(200).json({
      success: true,
      message: "Profile updated successfully!",
      data: { user: updatedUser },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/user/all — get all users (Admin only)
const getAllUsers = async (req, res, next) => {
  try {
    const users = await userService.getAllUsers();
    res.status(200).json({
      success: true,
      count: users.length,
      data: { users },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/user/:id — Admin updates a user
const adminUpdateUser = async (req, res, next) => {
  try {
    const updatedUser = await userService.adminUpdateUser(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: "User updated successfully!",
      data: { user: updatedUser },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/user/:id — Admin deletes a user
const adminDeleteUser = async (req, res, next) => {
  try {
    await userService.adminDeleteUser(req.params.id);
    res.status(200).json({
      success: true,
      message: "User deleted successfully!",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile, getAllUsers, adminUpdateUser, adminDeleteUser };
