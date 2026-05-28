const dotenv = require("dotenv");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGO_URI;

const seedAdmin = async () => {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is required");
  }

  await mongoose.connect(MONGO_URI);

  const email = (process.env.ADMIN_EMAIL || "admin@jsp.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "admin@123";

  const existing = await User.findOne({ email });
  if (existing) {
    console.log("Admin user already exists");
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    name: "Admin",
    email,
    passwordHash,
    role: "admin",
    status: "active"
  });

  console.log("Admin user created");
  await mongoose.disconnect();
};

seedAdmin().catch((error) => {
  console.error("Failed to seed admin", error);
  process.exit(1);
});
