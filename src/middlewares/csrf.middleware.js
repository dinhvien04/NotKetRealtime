const config = require("../config/env");
const authService = require("../services/auth.service");
const csrfService = require("../services/csrf.service");
const { getTokenFromRequest } = require("./auth.middleware");

function setCsrfCookie(res, token) {
  res.cookie(config.csrfCookieName, token, {
    httpOnly: false,
    sameSite: "lax",
    secure: config.isProduction,
    maxAge: config.jwtMaxAgeMs,
    path: "/"
  });
}

function clearCsrfCookie(res) {
  res.clearCookie(config.csrfCookieName, {
    httpOnly: false,
    sameSite: "lax",
    secure: config.isProduction,
    path: "/"
  });
}

function getSessionFromRequest(req) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return null;
  }

  try {
    const payload = authService.verifyToken(token);
    if (payload.sub && payload.sid) {
      return { sub: payload.sub, sid: payload.sid };
    }
  } catch (_error) {
    // ignore invalid auth cookie for CSRF issuance
  }

  return null;
}

function issueCsrfToken(req, res) {
  const session = getSessionFromRequest(req);
  const token = csrfService.generateCsrfToken(session || {});
  setCsrfCookie(res, token);
  return res.json({ ok: true, csrfToken: token });
}

function requireCsrf(req, res, next) {
  const cookieToken = req.cookies?.[config.csrfCookieName];
  const headerToken = req.get("X-CSRF-Token");
  const session = req.user?.id ? getSessionFromRequest(req) : null;

  if (!csrfService.validateCsrfRequest(cookieToken, headerToken, session)) {
    return res.status(403).json({
      ok: false,
      error: "CSRF token không hợp lệ."
    });
  }

  return next();
}

function rotateCsrfToken(res, session) {
  const token = csrfService.generateCsrfToken(session);
  setCsrfCookie(res, token);
  return token;
}

module.exports = {
  issueCsrfToken,
  requireCsrf,
  setCsrfCookie,
  clearCsrfCookie,
  rotateCsrfToken,
  getSessionFromRequest
};