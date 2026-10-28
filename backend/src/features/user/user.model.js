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
 *
 * Session handling: `tokenVersion` is embedded in every JWT. Changing the
 * password, resetting it, or "signing out everywhere" bumps the version so
 * older tokens stop working even though JWTs are stateless.
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

    // Doctors: speciality / licence shown to patients choosing a doctor
    speciality: { type: String, trim: true, default: "" },
    licenseNumber: { type: String, trim: true, default: "" },

    // ── Account Status ─────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,  // Account is active by default
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // ── Account recovery ───────────────────────────────────────────────
    recoveryEmail: { type: String, lowercase: true, trim: true, default: "" },
    passwordResetToken: { type: String, select: false },   // sha256 of the OTP
    passwordResetExpires: { type: Date, select: false },
    passwordResetAttempts: { type: Number, default: 0, select: false },
    passwordChangedAt: { type: Date, default: null },

    // ── Session & brute-force protection ───────────────────────────────
    tokenVersion: { type: Number, default: 0 },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, default: null, select: false },
    lastLoginAt: { type: Date, default: null },

    // ── Privacy ────────────────────────────────────────────────────────
    privacyConsentAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },

    // ── Relationships ──────────────────────────────────────────────────
    // Patients can be linked to a primary doctor (see DoctorPatientLink)
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
  if (!this.isNew) this.passwordChangedAt = new Date();

  next(); // Continue to save the document
});

// ── INSTANCE METHODS ────────────────────────────────────────────────────

/**
 * comparePassword — verifies a plain text password against the stored hash
 */
userSchema.methods.comparePassword = async function (enteredPassword) {
  // bcrypt.compare handles the salt/hash comparison internally
  return await bcrypt.compare(enteredPassword, this.password);
};

/** True while the account is temporarily locked after too many failed logins. */
userSchema.methods.isLocked = function () {
  return Boolean(this.lockUntil && this.lockUntil > new Date());
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
    speciality: this.speciality,
    licenseNumber: this.licenseNumber,
    isActive: this.isActive,
    isEmailVerified: this.isEmailVerified,
    recoveryEmail: this.recoveryEmail,
    privacyConsentAt: this.privacyConsentAt,
    lastLoginAt: this.lastLoginAt,
    passwordChangedAt: this.passwordChangedAt,
    assignedDoctor: this.assignedDoctor,
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
