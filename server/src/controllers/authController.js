const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const buildToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });

const register = async (req, res) => {
  const { name, email, password, role, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (password.length < 4) {
    return res.status(400).json({ message: "Password must be at least 4 characters" });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: "Email already in use" });
  }

  if (role === "admin") {
    return res.status(403).json({ message: "Admin registration is not allowed" });
  }

  if (role && !["manager", "cashier"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    name,
    email: email.toLowerCase(),
    phone,
    passwordHash,
    role: role || "cashier",
    approvalStatus: "pending",
    status: "inactive"
  });

  return res.status(201).json({
    message: "Registration submitted successfully. Please wait for admin approval."
  });
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Missing credentials" });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (user.role === "admin") {
    const token = buildToken(user);
    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        approvalStatus: user.approvalStatus || "approved",
        status: user.status || "active"
      }
    });
  }

  const approvalStatus = user.approvalStatus || "approved";
  const accountStatus = user.status || "active";

  if (approvalStatus === "pending") {
    return res.status(403).json({ message: "Your account is pending admin approval." });
  }

  if (approvalStatus === "rejected") {
    return res.status(403).json({ message: "Your account request has been rejected." });
  }

  if (accountStatus !== "active") {
    return res.status(403).json({ message: "Your account is inactive. Please contact admin." });
  }

  const token = buildToken(user);
  return res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      approvalStatus: approvalStatus,
      status: accountStatus
    }
  });
};

const me = async (req, res) => {
  return res.json({ user: req.user });
};

module.exports = { register, login, me };
