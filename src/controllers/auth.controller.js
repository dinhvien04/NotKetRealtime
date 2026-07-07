const authService = require("../services/auth.service");
const passwordResetService = require("../services/password-reset.service");
const auditService = require("../services/audit.service");
const { getDatabaseError } = require("../db");
const {
  setAuthCookie,
  clearAuthCookie,
  getTokenFromRequest
} = require("../middlewares/auth.middleware");
const {
  rotateCsrfToken,
  clearCsrfCookie
} = require("../middlewares/csrf.middleware");

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
    const user = await authService.register(req.body || {}, req);
    const { token, sid } = authService.createToken(user);
    setAuthCookie(res, token);
    const csrfToken = rotateCsrfToken(res, { sub: user.id, sid });
    return res.status(201).json({ ok: true, user, csrfToken });
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
    const user = await authService.login(req.body || {}, req);
    const { token, sid } = authService.createToken(user);
    setAuthCookie(res, token);
    const csrfToken = rotateCsrfToken(res, { sub: user.id, sid });
    return res.json({ ok: true, user, csrfToken });
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: error.message || "Không thể đăng nhập."
    });
  }
}

async function logout(req, res) {
  if (req.user?.id) {
    await auditService.log({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: "auth.logout",
      targetType: "user",
      targetId: req.user.id,
      req
    });
  }

  clearAuthCookie(res);
  clearCsrfCookie(res);
  return res.json({ ok: true });
}

async function forgotPassword(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const result = await passwordResetService.requestOtp({
      email: req.body?.email,
      req
    });
    return res.json({ ok: true, message: result.message });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể xử lý yêu cầu."
    });
  }
}

async function verifyResetOtp(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const result = await passwordResetService.verifyOtp({
      email: req.body?.email,
      otp: req.body?.otp,
      req
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "OTP không hợp lệ."
    });
  }
}

async function resetPassword(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    await passwordResetService.resetPassword({
      resetTokenId: req.body?.resetTokenId,
      password: req.body?.password,
      confirmPassword: req.body?.confirmPassword,
      req
    });
    return res.json({
      ok: true,
      message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại."
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể đặt lại mật khẩu."
    });
  }
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
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  me,
  meFromCookie
};