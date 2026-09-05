/**
 * DATABASE CONFIGURATION — db.js
 * ================================
 * This file handles the MongoDB connection using Mongoose.
 *
 * WHY a separate file?
 * → Keeps connection logic isolated. If you ever switch databases,
 *   you only change this one file, not your whole app.
 *
 * HOW it works:
 * → mongoose.connect() opens a connection to MongoDB.
 * → We export a function so server.js can call it on startup.
 */

const mongoose = require("mongoose");
const dns = require('dns');

// Force Node.js to use Google DNS to bypass ISP SRV record blocking
dns.setServers(['8.8.8.8', '8.8.4.4']);

/**
 * connectDB — async function that connects to MongoDB
 * We use async/await for clean, readable error handling.
 */
const connectDB = async () => {
  try {
    // mongoose.connect() returns a promise
    // process.env.MONGO_URI reads the value from our .env file
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // These options suppress deprecation warnings
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // Timeout after 10s instead of 30s
      family: 4 // Force IPv4 to fix DNS SRV resolution issues in Node.js
    });

    // conn.connection.host shows which server MongoDB connected to
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // If connection fails, log the error and stop the process
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1); // Exit with failure code
  }
};

// Export the function so server.js can import and call it
module.exports = connectDB;
