/**
 * AUTH MIDDLEWARE — authMiddleware.js
 * ======================================
 * This middleware protects routes that require authentication.
 * It runs BEFORE your controller on any protected route.
 *
 * HOW JWT AUTHENTICATION WORKS:
 * 1. User logs in → server sends them a JWT token
 * 2. Client stores the token (SecureStore on the phone)
 * 3. On every protected request, client sends:
 *    Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * 4. This middleware reads that header, verifies the token,
 *    fetches the user from DB, and attaches them to req.user
 * 5. The controller then has access to req.user
 *
 * Session handling: the token carries `tv` (tokenVersion). When the user
 * changes/resets their password or signs out everywhere, the version is
 * bumped and every older token is rejected with 401.
 *
 * If the token is missing or invalid → 401 Unauthorized error
 */

const jwt = require("jsonwebtoken");
const User = require("../features/user/user.model");

const unauthorized = (message) => {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
};

const extractToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    return req.headers.authorization.split(" ")[1];
  }
  // File downloads opened by the OS viewer cannot set headers → allow ?token=
  if (req.query && typeof req.query.token === "string" && req.query.token.length > 20) {
    return req.query.token;
  }
  return null;
};

// ── PROTECT MIDDLEWARE ────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return next(unauthorized("Access denied. Please log in to continue."));

    // Verify the token using our secret key → { userId, role, tv, iat, exp }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user) return next(unauthorized("The user associated with this token no longer exists."));

    if (!user.isActive || user.deletedAt) {
      return next(unauthorized("Your account has been deactivated. Please contact support."));
    }

    // Reject tokens issued before the last password change / global sign-out
    if ((decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      return next(unauthorized("Your session is no longer valid. Please log in again."));
    }

    req.user = user.getPublicProfile();
    req.user._id = user._id; // keep ObjectId for controllers expecting it
    req.token = decoded;

    next();
  } catch (error) {
    // jwt.verify() errors (invalid/expired tokens) go to errorHandler.js
    next(error);
  }
};

/**
 * optionalAuth — populates req.user when a valid token is present but does
 * not reject the request otherwise (used by the maintenance gate).
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return next();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (user && user.isActive && (decoded.tv ?? 0) === (user.tokenVersion ?? 0)) {
      req.user = user.getPublicProfile();
      req.user._id = user._id;
    }
  } catch {
    // ignore — the route's own `protect` will reject if needed
  }
  next();
};

module.exports = { protect, optionalAuth };
