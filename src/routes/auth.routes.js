const express = require("express");
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/auth.controller");
const { requireAuth, optionalAuth } = require("../middlewares/auth.middleware");
const { requireCsrf } = require("../middlewares/csrf.middleware");

const router = express.Router();

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Quá nhiều lần thử. Vui lòng thử lại sau." }
});

const forgotPasswordRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: "Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau."
  }
});

router.post("/register", authRateLimit, requireCsrf, authController.register);
router.post("/login", authRateLimit, requireCsrf, authController.login);
router.post("/logout", optionalAuth, requireCsrf, authController.logout);
router.post(
  "/forgot-password",
  forgotPasswordRateLimit,
  requireCsrf,
  authController.forgotPassword
);
router.post(
  "/verify-reset-otp",
  forgotPasswordRateLimit,
  requireCsrf,
  authController.verifyResetOtp
);
router.post(
  "/reset-password",
  forgotPasswordRateLimit,
  requireCsrf,
  authController.resetPassword
);
router.get("/me", authController.meFromCookie);
router.get("/session", requireAuth, authController.me);

module.exports = router;