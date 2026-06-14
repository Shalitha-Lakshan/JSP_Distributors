const User = require("../models/User");

const listPendingUsers = async (_req, res) => {
  const users = await User.find({ approvalStatus: "pending" })
    .sort({ createdAt: -1 })
    .select("-passwordHash");
  return res.json(users);
};

const listUsers = async (req, res) => {
  const { approvalStatus } = req.query;
  const filter = {};

  if (approvalStatus) {
    filter.approvalStatus = approvalStatus;
  }

  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .select("-passwordHash");
  return res.json(users);
};

const approveUser = async (req, res) => {
  const { role } = req.body;

  if (role && !["admin", "manager", "rep"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  user.approvalStatus = "approved";
  user.status = "active";
  user.approvedBy = req.user._id;
  user.approvedAt = new Date();
  user.rejectedBy = undefined;
  user.rejectedAt = undefined;
  user.rejectionReason = undefined;

  if (role) {
    user.role = role;
  }

  await user.save();
  const safeUser = user.toObject();
  delete safeUser.passwordHash;
  return res.json(safeUser);
};

const rejectUser = async (req, res) => {
  const { reason } = req.body;
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  user.approvalStatus = "rejected";
  user.status = "inactive";
  user.rejectedBy = req.user._id;
  user.rejectedAt = new Date();
  user.rejectionReason = reason || "";

  await user.save();
  const safeUser = user.toObject();
  delete safeUser.passwordHash;
  return res.json(safeUser);
};

const updateStatus = async (req, res) => {
  const { status } = req.body;

  if (!status || !["active", "inactive"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  );

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const safeUser = user.toObject();
  delete safeUser.passwordHash;
  return res.json(safeUser);
};

const updateRole = async (req, res) => {
  const { role } = req.body;

  if (!role || !["admin", "manager", "rep"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true }
  );

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const safeUser = user.toObject();
  delete safeUser.passwordHash;
  return res.json(safeUser);
};

module.exports = {
  listPendingUsers,
  listUsers,
  approveUser,
  rejectUser,
  updateStatus,
  updateRole
};
