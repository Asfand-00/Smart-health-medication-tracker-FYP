/**
 * AUTH MIDDLEWARE — authMiddleware.js
 * ======================================
 * This middleware protects routes that require authentication.
 * It runs BEFORE your controller on any protected route.
 *
 * HOW JWT AUTHENTICATION WORKS:
 * 1. User logs in → server sends them a JWT token
 * 2. Client stores the token (localStorage or cookie)
 * 3. On every protected request, client sends:
 *    Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * 4. This middleware reads that header, verifies the token,
 *    fetches the user from DB, and attaches them to req.user
 * 5. The controller then has access to req.user
 *
 * If the token is missing or invalid → 401 Unauthorized error
 */

const jwt = require("jsonwebtoken");
const User = require("../features/user/user.model");

// ── PROTECT MIDDLEWARE ────────────────────────────────────────────────────
/**
 * protect — verifies JWT and attaches user to request
 * Use this on any route that requires login.
 *
 * USAGE in routes: router.get("/profile", protect, controller)
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Step 1: Extract token from Authorization header
    // Header format: "Authorization: Bearer <token>"
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      // Split "Bearer eyJhbG..." → take the second part (the token)
      token = req.headers.authorization.split(" ")[1];
    }

    // If no token found, reject the request
    if (!token) {
      const error = new Error(
        "Access denied. Please log in to continue."
      );
      error.statusCode = 401;
      return next(error);
    }

    // Step 2: Verify the token using our secret key
    // jwt.verify() decodes and validates the token signature
    // Returns the payload we stored: { userId, role, iat, exp }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Step 3: Fetch the user from database using the ID from token
    // We do this to ensure the user still exists and is still active
    const user = await User.findById(decoded.userId);

    if (!user) {
      const error = new Error(
        "The user associated with this token no longer exists."
      );
      error.statusCode = 401;
      return next(error);
    }

    // Check if account is still active
    if (!user.isActive) {
      const error = new Error(
        "Your account has been deactivated. Please contact support."
      );
      error.statusCode = 401;
      return next(error);
    }

    // Step 4: Attach user to request object
    // Now req.user is available in all downstream controllers
    req.user = user.getPublicProfile();
    req.user._id = user._id; // Ensure _id is available for backward compatibility with controllers expecting it

    // Step 5: Continue to the next middleware/controller
    next();
  } catch (error) {
    // This catches jwt.verify() errors (invalid/expired tokens)
    next(error); // Goes to errorHandler.js which handles JWT-specific errors
  }
};

module.exports = { protect };
