/**
 * SERVER ENTRY POINT — server.js
 * ================================
 * - HTTP server + Socket.io for real-time features
 * - Background scheduler (reminders, escalation, AI alerts, daily jobs)
 * - Seeds global medication templates and the platform configuration
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
if (!process.env.MONGO_URI) {
  require("dotenv").config({ path: path.resolve(__dirname, "../env") });
}

const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === "production" ? (process.env.CLIENT_URLS || process.env.CLIENT_URL || "").split(",").map((s) => s.trim()) : true,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

/**
 * Each user joins their own "room" named by their userId so controllers can
 * emit to exactly one person: io.to(userId).emit(...)
 */
io.on("connection", (socket) => {
  socket.on("join", (userId) => {
    if (typeof userId === "string" && userId.length <= 64) {
      socket.join(userId);
      socket.data.userId = userId;
    }
  });

  socket.on("disconnect", () => {});
});

app.locals.io = io;

const reminderScheduler = require("./features/smart-reminder/reminderScheduler");

const startServer = async () => {
  try {
    await connectDB();

    // Seed platform configuration + global templates on first run
    const SystemConfig = require("./features/admin/systemConfig.model");
    await SystemConfig.getConfig(true);
    const { seedTemplates } = require("./features/medication-plan/medicationPlan.controller");
    await seedTemplates();

    reminderScheduler.initScheduler(io);

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
