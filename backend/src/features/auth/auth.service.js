/**
 * AUTH SERVICE — auth.service.js
 * ================================
 * Contains ALL the business logic for authentication.
 *
 * WHY a separate service file?
 * → Controllers should be THIN — they only handle HTTP requests/responses.
 * → Services contain the actual LOGIC — database queries, token creation, etc.
 * → This makes code reusable and testable.
 *
 * RULE: Never put database queries directly in controllers.
 */

const jwt = require("jsonwebtoken");
const User = require("../user/user.model");

// ── HELPER: Generate JWT Token ───────────────────────────────────────────
/**
 * generateToken — creates a signed JWT token for a user
 *
 * WHAT IS A JWT?
 * → JSON Web Token = a secure string that encodes user info.
 * → It has 3 parts: Header.Payload.Signature
 * → The server signs it with a SECRET KEY, so it can't be faked.
 * → The client stores it and sends it with every request.
 *
 * PAYLOAD: What we store inside the token
 * → userId: so we know WHO made the request
 * → role: so we know WHAT they're allowed to do
 *
 * @param {string} userId - MongoDB user ID
 * @param {string} role   - User role (patient/caregiver/doctor/admin)
 * @returns {string}      - Signed JWT token
 */
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },             // Payload (data stored inside token)
    process.env.JWT_SECRET,       // Secret key from .env file
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" } // Token expires in 7 days
  );
};

// ── REGISTER SERVICE ─────────────────────────────────────────────────────
/**
 * registerUser — creates a new user account
 *
 * STEPS:
 * 1. Check if email already exists (prevent duplicates)
 * 2. Create the user (password is auto-hashed by pre-save hook in model)
 * 3. Generate a JWT token
 * 4. Return the token and public user profile
 *
 * @param {object} userData - { firstName, lastName, email, password, role }
 * @returns {object}        - { token, user }
 */
const registerUser = async (userData) => {
  const { firstName, lastName, email, password, role } = userData;

  // Step 1: Check if email already taken
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    const error = new Error("An account with this email already exists.");
    error.statusCode = 400;
    throw error;
  }

  // Step 2: Create user — password gets hashed by the pre-save hook automatically
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    role: role || "patient", // Default to patient if no role provided
  });

  // Step 3: Generate JWT
  const token = generateToken(user._id, user.role);

  // Step 4: Return token + safe user data (no password)
  return {
    token,
    user: user.getPublicProfile(),
  };
};

// ── LOGIN SERVICE ────────────────────────────────────────────────────────
/**
 * loginUser — authenticates an existing user
 *
 * STEPS:
 * 1. Find user by email (include password field — it's hidden by default)
 * 2. Check if account exists and is active
 * 3. Compare entered password with stored hash
 * 4. Generate a JWT token
 * 5. Return the token and public user profile
 *
 * SECURITY NOTE: We use the same generic error message for
 * "email not found" and "wrong password" to prevent attackers from
 * discovering which emails are registered (enumeration attack prevention).
 *
 * @param {string} email
 * @param {string} password
 * @returns {object} - { token, user }
 */
const loginUser = async (email, password) => {
  // Step 1: Find user by email
  // .select("+password") overrides the "select: false" in the model
  // so password hash is included in this specific query
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+password"
  );

  // Step 2: Check user exists and account is active
  if (!user || !user.isActive) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401; // 401 = Unauthorized
    throw error;
  }

  // Step 3: Compare plain text password with stored bcrypt hash
  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  // Step 4: Generate JWT token
  const token = generateToken(user._id, user.role);

  // Step 5: Return token + safe profile (password not included)
  return {
    token,
    user: user.getPublicProfile(),
  };
};

module.exports = { registerUser, loginUser };
