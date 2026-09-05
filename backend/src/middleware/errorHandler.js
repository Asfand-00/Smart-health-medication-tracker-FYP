/**
 * GLOBAL ERROR HANDLER — errorHandler.js
 * ========================================
 * This middleware catches ALL errors thrown anywhere in your app.
 *
 * WHY a global error handler?
 * → Without this, Express would send ugly HTML error pages.
 * → With this, we always send clean JSON responses to the frontend.
 * → It's the "safety net" for your entire API.
 *
 * HOW Express identifies error-handling middleware:
 * → It MUST have exactly 4 parameters: (err, req, res, next)
 * → Express knows it's an error handler because of the "err" first param.
 */

const errorHandler = (err, req, res, next) => {
  // Use the error's status code, or default to 500 (Internal Server Error)
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // ── Handle specific Mongoose error types ──────────────────────────────

  // Mongoose CastError: happens when an invalid MongoDB ID is provided
  // e.g., GET /api/user/not-a-valid-id
  if (err.name === "CastError") {
    statusCode = 404;
    message = `Resource not found with id: ${err.value}`;
  }

  // Mongoose Duplicate Key Error (code 11000)
  // e.g., trying to register with an email that already exists
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0]; // e.g., "email"
    message = `${field} already exists. Please use a different one.`;
  }

  // Mongoose Validation Error: required fields missing or invalid
  if (err.name === "ValidationError") {
    statusCode = 400;
    // Collect all validation error messages into one array
    message = Object.values(err.errors).map((val) => val.message);
  }

  // JWT Errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token. Please log in again.";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Your session has expired. Please log in again.";
  }

  // ── Send JSON error response ──────────────────────────────────────────
  res.status(statusCode).json({
    success: false,
    message,
    // Only show stack trace in development mode (never in production!)
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;
