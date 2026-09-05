/**
 * SERVER ENTRY POINT — server.js
 * ================================
 * Now upgraded with Socket.io for real-time features:
 * - Real-time reminders from caregiver → patient
 * - Missed medication alerts caregiver → caregiver
 * - "Poke" patient from caregiver in real-time
 */

require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

// Create HTTP server from Express app
const httpServer = http.createServer(app);

// Attach Socket.io to the HTTP server
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

/**
 * SOCKET.IO Connection Handler
 * 
 * Each user joins their own "room" using their userId.
 * This allows us to send targeted messages to specific users.
 * 
 * Example: When caregiver sends reminder to patient with userId "abc123",
 * we emit to room "abc123" and only that patient receives it.
 */
io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // User joins their personal room based on their userId
  socket.on("join", (userId) => {
    socket.join(userId);
    console.log(`👤 User ${userId} joined their room`);
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// Make io accessible everywhere via app.locals
// This allows controllers to emit events: req.app.locals.io.to(userId).emit(...)
app.locals.io = io;

// Start smart reminder background scheduler
const reminderScheduler = require("./features/smart-reminder/reminderScheduler");
reminderScheduler.initScheduler(io);

const startServer = async () => {
  try {
    await connectDB();

    httpServer.listen(PORT, () => {
      console.log("═══════════════════════════════════════════");
      console.log("🚀 Smart Medication Tracker API");
      console.log(`📡 Server running on port: ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 URL: http://localhost:${PORT}/api/health`);
      console.log("🔌 Socket.io: ENABLED");
      console.log("═══════════════════════════════════════════");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err.message);
  process.exit(1);
});

startServer();
