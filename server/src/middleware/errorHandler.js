module.exports = (err, _req, res, _next) => {
  const status = err.status || 500;
  const message = err.message || "Server error";
  res.status(status).json({ message });
};
