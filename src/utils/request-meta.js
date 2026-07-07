function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || null;
}

function getUserAgent(req) {
  const value = req.get("user-agent");
  return value ? value.slice(0, 500) : null;
}

module.exports = {
  getClientIp,
  getUserAgent
};