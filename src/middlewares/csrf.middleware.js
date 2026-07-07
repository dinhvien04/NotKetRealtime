const config = require("../config/env");
const csrfService = require("../services/csrf.service");

function generateCsrfToken() {
  return csrfService.generateCsrfToken();
}

function setCsrfCookie(res, token) {
  res.cookie(config.csrfCookieName, token, {
    httpOnly: false,
    sameSite: "lax",
    secure: config.isProduction,
    maxAge: config.jwtMaxAgeMs,
    path: "/"
  });
}

function issueCsrfToken(req, res) {
  const token = generateCsrfToken();
  setCsrfCookie(res, token);
  return res.json({ ok: true, csrfToken: token });
}

function requireCsrf(req, res, next) {
  const cookieToken = req.cookies?.[config.csrfCookieName];
  const headerToken = req.get("X-CSRF-Token");

  if (!csrfService.validateCsrfRequest(cookieToken, headerToken)) {
    return res.status(403).json({
      ok: false,
      error: "CSRF token không hợp lệ."
    });
  }

  return next();
}

module.exports = {
  issueCsrfToken,
  requireCsrf,
  setCsrfCookie,
  generateCsrfToken
};