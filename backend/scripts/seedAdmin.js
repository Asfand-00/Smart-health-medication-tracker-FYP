require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/features/user/user.model");

// Configure DNS just in case, like we did in db.js
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const seedAdmin = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      family: 4,
    });
    console.log("Connected to DB.");

    const adminEmail = "ali@gmail.com";
    const adminPassword = "ali123";

    // Check if admin already exists
    let adminUser = await User.findOne({ email: adminEmail });
    if (adminUser) {
      console.log(`Admin user ${adminEmail} already exists. Updating password...`);
      adminUser.password = adminPassword; // Will be hashed by pre-save hook
      await adminUser.save();
      console.log("Admin password updated successfully!");
    } else {
      console.log(`Creating new admin user: ${adminEmail}`);
      adminUser = new User({
        firstName: "System",
        lastName: "Admin",
        email: adminEmail,
        password: adminPassword, // Will be hashed by pre-save hook
        role: "admin",
      });
      await adminUser.save();
      console.log("Admin user created successfully!");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error seeding admin:", error);
    process.exit(1);
  }
};

seedAdmin();
