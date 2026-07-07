const config = require("../config/env");

const ALLOWED_SEC_FETCH_SITE = new Set(["same-origin", "same-site", "none"]);

function requireSameOriginFetch(req, res, next) {
  if (!config.isProduction) {
    return next();
  }

  const method = String(req.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }

  const secFetchSite = String(req.get("Sec-Fetch-Site") || "").toLowerCase();
  if (!secFetchSite) {
    return next();
  }

  if (secFetchSite === "cross-site") {
    return res.status(403).json({
      ok: false,
      error: "Yêu cầu cross-site không được phép."
    });
  }

  if (!ALLOWED_SEC_FETCH_SITE.has(secFetchSite)) {
    return res.status(403).json({
      ok: false,
      error: "Yêu cầu không hợp lệ."
    });
  }

  return next();
}

module.exports = {
  requireSameOriginFetch
};