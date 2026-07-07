const config = require("../config/env");
const authService = require("../services/auth.service");

const STAFF_ROLES = new Set(["admin", "moderator"]);

function getTokenFromRequest(req) {
  return req.cookies?.[config.cookieName] || null;
}

function setAuthCookie(res, token) {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    maxAge: config.jwtMaxAgeMs,
    path: "/"
  });
}

function clearAuthCookie(res) {
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    path: "/"
  });
}

async function requireAuth(req, res, next) {
  try {
    const configError = authService.getAuthConfigError();
    if (configError) {
      return res.status(503).json({ ok: false, error: configError });
    }

    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: "Bạn cần đăng nhập." });
    }

    const payload = authService.verifyToken(token);
    req.user = await authService.getUserFromToken(token);
    if (payload.sid) {
      req.session = { sub: payload.sub, sid: payload.sid };
    }
    return next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."
    });
  }
}

async function optionalAuth(req, res, next) {
  try {
    const configError = authService.getAuthConfigError();
    if (configError) {
      return next();
    }

    const token = getTokenFromRequest(req);
    if (!token) {
      return next();
    }

    req.user = await authService.getUserFromToken(token);
  } catch (_error) {
    // ignore invalid session for optional auth routes
  }

  return next();
}

function requireAuthPage(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return res.redirect("/?auth=login");
  }

  try {
    authService.verifyToken(token);
    return next();
  } catch (error) {
    clearAuthCookie(res);
    return res.redirect("/?auth=login");
  }
}

async function requireStaffPage(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return res.redirect("/?auth=login");
  }

  try {
    const user = await authService.getUserFromToken(token);
    if (!STAFF_ROLES.has(user.role)) {
      return res.redirect("/chat");
    }
    req.user = user;
    return next();
  } catch (error) {
    clearAuthCookie(res);
    return res.redirect("/?auth=login");
  }
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireAuthPage,
  requireStaffPage,
  getTokenFromRequest,
  setAuthCookie,
  clearAuthCookie
};