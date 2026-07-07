const express = require("express");
const rateLimit = require("express-rate-limit");
const messageController = require("../controllers/message.controller");
const { requireAuth } = require("../middlewares/auth.middleware");
const { requireCsrf } = require("../middlewares/csrf.middleware");

const router = express.Router();

const messageRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Quá nhiều thao tác tin nhắn. Vui lòng thử lại sau." }
});

const searchRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Quá nhiều yêu cầu tìm kiếm. Vui lòng thử lại sau." }
});

router.get("/search", requireAuth, searchRateLimit, messageController.searchMessages);
router.patch("/:id", requireAuth, requireCsrf, messageRateLimit, messageController.editMessage);
router.delete("/:id", requireAuth, requireCsrf, messageRateLimit, messageController.deleteMessage);
router.post(
  "/:id/reactions",
  requireAuth,
  requireCsrf,
  messageRateLimit,
  messageController.addReaction
);
router.delete(
  "/:id/reactions",
  requireAuth,
  requireCsrf,
  messageRateLimit,
  messageController.removeReaction
);

module.exports = router;