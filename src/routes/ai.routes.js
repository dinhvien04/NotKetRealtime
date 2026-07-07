const express = require("express");
const rateLimit = require("express-rate-limit");
const aiController = require("../controllers/ai.controller");
const { requireAuth } = require("../middlewares/auth.middleware");
const { requireCsrf } = require("../middlewares/csrf.middleware");

const router = express.Router();

const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Quá nhiều yêu cầu AI. Vui lòng thử lại sau." }
});

router.get("/sessions", requireAuth, aiController.listSessions);
router.post(
  "/sessions",
  requireAuth,
  requireCsrf,
  aiRateLimit,
  aiController.createSession
);
router.get("/sessions/:id/messages", requireAuth, aiController.getSessionMessages);
router.post(
  "/sessions/:id/messages",
  requireAuth,
  requireCsrf,
  aiRateLimit,
  aiController.sendMessage
);
router.delete(
  "/sessions/:id",
  requireAuth,
  requireCsrf,
  aiRateLimit,
  aiController.deleteSession
);

module.exports = router;