/**
 * USER MODEL — user.model.js
 * ============================
 * This defines the shape of a "User" document in MongoDB.
 *
 * WHAT is a Mongoose Model?
 * → A model is a class that represents a MongoDB collection.
 * → Every time you create a new user, Mongoose uses this schema
 *   to validate the data before saving it to the database.
 *
 * KEY CONCEPTS USED HERE:
 * → Schema          : defines the structure (fields, types, rules)
 * → pre('save') hook: runs code BEFORE saving — used to hash passwords
 * → methods         : custom functions on each user document
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// ── USER SCHEMA DEFINITION ───────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    // ── Personal Info ──────────────────────────────────────────────────
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,               // Removes whitespace from both ends
      minlength: [2, "First name must be at least 2 characters"],
      maxlength: [50, "First name cannot exceed 50 characters"],
    },

    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      minlength: [2, "Last name must be at least 2 characters"],
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,             // Ensures no two users share an email
      lowercase: true,          // Automatically converts to lowercase
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email address",
      ],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,  // ← IMPORTANT: password is NEVER returned in queries by default
                      // You must explicitly request it with .select("+password")
    },

    // ── Role-Based Access Control ──────────────────────────────────────
    role: {
      type: String,
      enum: {
        values: ["patient", "caregiver", "doctor", "admin"],
        message: "Role must be: patient, caregiver, doctor, or admin",
      },
      default: "patient",  // New users are patients by default
    },

    // ── Contact & Profile ──────────────────────────────────────────────
    phone: {
      type: String,
      trim: true,
      default: null,
    },

    dateOfBirth: {
      type: Date,
      default: null,
    },

    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
      default: null,
    },

    avatar: {
      type: String,   // URL to profile picture
      default: null,
    },

    // ── Account Status ─────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,  // Account is active by default
    },

    isEmailVerified: {
      type: Boolean,
      default: false,  // Email verification (for future module)
    },

    // ── Password Reset (for future account recovery module) ────────────
    passwordResetToken: String,
    passwordResetExpires: Date,

    // ── Relationships (for future modules) ────────────────────────────
    // Patients can be linked to caregivers and doctors
    assignedDoctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",   // References another User document
      default: null,
    },
  },

  /**
   * Schema Options:
   * timestamps: true → Mongoose auto-adds createdAt and updatedAt fields
   * This is extremely useful for tracking when records were created/modified.
   */
  {
    timestamps: true,
  }
);

// ── PRE-SAVE MIDDLEWARE (Password Hashing) ──────────────────────────────
/**
 * WHAT IS A PRE-SAVE HOOK?
 * → This function runs automatically BEFORE every .save() call.
 * → We use it to hash the password so we NEVER store plain text.
 *
 * WHY bcrypt?
 * → bcrypt is a one-way hashing algorithm designed for passwords.
 * → Even if your database is stolen, attackers can't reverse the hash.
 * → The "salt rounds" (10) controls how slow/secure the hash is.
 *
 * WHY check isModified('password')?
 * → We only re-hash if the password CHANGED.
 * → If a user updates their name, we don't want to re-hash the existing hash!
 */
userSchema.pre("save", async function (next) {
  // "this" refers to the current user document being saved
  if (!this.isModified("password")) {
    return next(); // Skip hashing, continue to save
  }

  // Generate a salt (random data added to password before hashing)
  // 10 rounds = good balance of security vs. speed
  const salt = await bcrypt.genSalt(10);

  // Hash the plain-text password with the salt
  this.password = await bcrypt.hash(this.password, salt);

  next(); // Continue to save the document
});

// ── INSTANCE METHODS ────────────────────────────────────────────────────

/**
 * comparePassword — verifies a plain text password against the stored hash
 *
 * HOW IT WORKS:
 * → bcrypt.compare() hashes the entered password the same way
 *   and checks if the result matches the stored hash.
 * → Returns true if they match, false otherwise.
 *
 * USAGE: const isMatch = await user.comparePassword("entered_password");
 */
userSchema.methods.comparePassword = async function (enteredPassword) {
  // bcrypt.compare handles the salt/hash comparison internally
  return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * getPublicProfile — returns user data without sensitive fields
 * We use this to safely send user data to the frontend.
 */
userSchema.methods.getPublicProfile = function () {
  return {
    _id: this._id,          // Include both for backward compatibility
    id: this._id,
    firstName: this.firstName,
    lastName: this.lastName,
    email: this.email,
    role: this.role,
    phone: this.phone,
    dateOfBirth: this.dateOfBirth,
    gender: this.gender,
    avatar: this.avatar,
    isActive: this.isActive,
    isEmailVerified: this.isEmailVerified,
    createdAt: this.createdAt,
  };
};

// ── VIRTUAL FIELDS ────────────────────────────────────────────────────
/**
 * fullName — computed property, not stored in DB
 * Accessed like: user.fullName → "John Doe"
 */
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Create the User model from the schema
// "User" → MongoDB will create a "users" collection (auto-pluralized)
const User = mongoose.model("User", userSchema);

module.exports = User;
