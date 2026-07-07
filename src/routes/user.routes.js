const express = require("express");
const rateLimit = require("express-rate-limit");
const userController = require("../controllers/user.controller");
const { requireAuth } = require("../middlewares/auth.middleware");
const { requireCsrf } = require("../middlewares/csrf.middleware");
const avatarMiddleware = require("../middlewares/avatar.middleware");

const router = express.Router();

const profileRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Quá nhiều yêu cầu. Vui lòng thử lại sau." }
});

router.get("/search", requireAuth, profileRateLimit, userController.searchUsers);
router.get("/me", requireAuth, userController.getMe);
router.patch("/me", requireAuth, requireCsrf, profileRateLimit, userController.updateMe);
router.post(
  "/me/avatar",
  requireAuth,
  requireCsrf,
  profileRateLimit,
  avatarMiddleware,
  userController.uploadMyAvatar
);
router.post(
  "/me/change-password",
  requireAuth,
  requireCsrf,
  profileRateLimit,
  userController.changePassword
);

module.exports = router;