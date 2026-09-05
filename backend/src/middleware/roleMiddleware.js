/**
 * ROLE MIDDLEWARE — roleMiddleware.js
 * =====================================
 * Controls access to routes based on user role.
 * This implements Role-Based Access Control (RBAC).
 *
 * WHAT IS RBAC?
 * → Different users have different permissions.
 * → A patient cannot see admin-only data.
 * → A doctor can view patient records, a caregiver cannot.
 *
 * HOW IT WORKS:
 * → This is a "middleware factory" — a function that RETURNS a middleware.
 * → You call it with the allowed roles: authorize("admin", "doctor")
 * → It returns the actual middleware function that checks req.user.role
 *
 * IMPORTANT: Always use this AFTER the protect middleware!
 * → protect() must run first to populate req.user
 * → authorize() then checks req.user.role
 *
 * USAGE:
 * router.get("/all-users", protect, authorize("admin"), controller)
 * router.get("/patients",  protect, authorize("doctor", "admin"), controller)
 */

/**
 * authorize — middleware factory for role-based access control
 *
 * @param {...string} roles - Allowed roles (e.g., "admin", "doctor")
 * @returns {Function}      - Express middleware function
 */
const authorize = (...roles) => {
  // Return the actual middleware function
  return (req, res, next) => {
    // req.user is set by the protect middleware that runs before this
    if (!req.user) {
      const error = new Error("Authentication required.");
      error.statusCode = 401;
      return next(error);
    }

    // Check if the user's role is in the list of allowed roles
    if (!roles.includes(req.user.role)) {
      const error = new Error(
        `Access denied. This action requires one of these roles: ${roles.join(", ")}. Your role is: ${req.user.role}.`
      );
      error.statusCode = 403; // 403 = Forbidden (authenticated but not authorized)
      return next(error);
    }

    // Role is allowed — continue to next middleware/controller
    next();
  };
};

module.exports = { authorize };
