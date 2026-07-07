function requireRole(...roles) {
  const allowed = new Set(roles);

  return function roleGuard(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Bạn cần đăng nhập." });
    }

    if (!allowed.has(req.user.role)) {
      return res.status(403).json({ ok: false, error: "Bạn không có quyền truy cập." });
    }

    return next();
  };
}

module.exports = {
  requireRole
};