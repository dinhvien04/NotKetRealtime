const express = require("express");
const rateLimit = require("express-rate-limit");
const conversationController = require("../controllers/conversation.controller");
const { requireAuth } = require("../middlewares/auth.middleware");
const { requireCsrf } = require("../middlewares/csrf.middleware");

const router = express.Router();

const groupRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Quá nhiều thao tác nhóm. Vui lòng thử lại sau." }
});

router.get("/public", requireAuth, conversationController.getPublicRoom);
router.get("/groups", requireAuth, conversationController.listGroups);
router.post(
  "/groups",
  requireAuth,
  requireCsrf,
  groupRateLimit,
  conversationController.createGroup
);
router.patch(
  "/:id",
  requireAuth,
  requireCsrf,
  groupRateLimit,
  conversationController.updateGroup
);
router.get("/:id/participants", requireAuth, conversationController.getParticipants);
router.post(
  "/:id/participants",
  requireAuth,
  requireCsrf,
  groupRateLimit,
  conversationController.addParticipant
);
router.delete(
  "/:id/participants/:userId",
  requireAuth,
  requireCsrf,
  groupRateLimit,
  conversationController.removeParticipant
);
router.post(
  "/:id/leave",
  requireAuth,
  requireCsrf,
  groupRateLimit,
  conversationController.leaveGroup
);
router.post(
  "/:id/transfer-owner",
  requireAuth,
  requireCsrf,
  groupRateLimit,
  conversationController.transferOwner
);

module.exports = router;