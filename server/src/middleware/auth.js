const jwt = require("jsonwebtoken");
const User = require("../models/User");

const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).select("-passwordHash");

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (user.role === "admin") {
      req.user = user;
      return next();
    }

    const approvalStatus = user.approvalStatus || "approved";
    const accountStatus = user.status || "active";

    if (approvalStatus === "rejected") {
      return res.status(403).json({ message: "Your account request has been rejected." });
    }

    if (approvalStatus !== "approved") {
      return res.status(403).json({ message: "Your account is pending admin approval." });
    }

    if (accountStatus !== "active") {
      return res.status(403).json({ message: "Your account is inactive. Please contact admin." });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

const requireRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  return next();
};

module.exports = { requireAuth, requireRole };
