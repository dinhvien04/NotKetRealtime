const authService = require("../services/auth.service");
const { getDatabaseError } = require("../db");
const {
  setAuthCookie,
  clearAuthCookie,
  getTokenFromRequest
} = require("../middlewares/auth.middleware");

async function register(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  const authError = authService.getAuthConfigError();
  if (authError) {
    return res.status(503).json({ ok: false, error: authError });
  }

  try {
    const user = await authService.register(req.body || {});
    const token = authService.createToken(user);
    setAuthCookie(res, token);
    return res.status(201).json({ ok: true, user });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể đăng ký tài khoản."
    });
  }
}

async function login(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  const authError = authService.getAuthConfigError();
  if (authError) {
    return res.status(503).json({ ok: false, error: authError });
  }

  try {
    const user = await authService.login(req.body || {});
    const token = authService.createToken(user);
    setAuthCookie(res, token);
    return res.json({ ok: true, user });
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: error.message || "Không thể đăng nhập."
    });
  }
}

function logout(req, res) {
  clearAuthCookie(res);
  return res.json({ ok: true });
}

async function me(req, res) {
  return res.json({ ok: true, user: req.user });
}

async function meFromCookie(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ ok: false, error: "Bạn cần đăng nhập." });
  }

  try {
    const user = await authService.getUserFromToken(token);
    return res.json({ ok: true, user });
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."
    });
  }
}

module.exports = {
  register,
  login,
  logout,
  me,
  meFromCookie
};