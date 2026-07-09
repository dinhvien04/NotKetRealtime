const crypto = require("crypto");
const config = require("../config/env");

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ""), "utf8");
  const bufB = Buffer.from(String(b || ""), "utf8");
  if (bufA.length !== bufB.length) {
    // Compare against self to keep constant-ish work without throwing
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function appAccessMiddleware(req, res, next) {
  if (config.appOpenMode) {
    return next();
  }

  const provided = req.get("X-App-Access-Key") || "";
  const expected = config.appAccessKey || "";

  if (!expected || !provided || !safeEqual(provided, expected)) {
    return res.status(401).json({
      ok: false,
      error: "Mã truy cập không hợp lệ."
    });
  }

  return next();
}

module.exports = appAccessMiddleware;
module.exports.safeEqual = safeEqual;
