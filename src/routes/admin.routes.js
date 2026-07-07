const express = require("express");
const rateLimit = require("express-rate-limit");
const adminController = require("../controllers/admin.controller");
const { requireAuth } = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");
const { requireCsrf } = require("../middlewares/csrf.middleware");

const router = express.Router();
const staff = [requireAuth, requireRole("admin", "moderator")];
const adminOnly = [requireAuth, requireRole("admin")];

const adminRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Quá nhiều thao tác admin. Vui lòng thử lại sau." }
});

router.get("/stats", ...staff, adminRateLimit, adminController.getStats);
router.get("/users", ...staff, adminRateLimit, adminController.listUsers);
router.patch(
  "/users/:id",
  ...staff,
  requireCsrf,
  adminRateLimit,
  adminController.updateUser
);
router.delete(
  "/users/:id",
  ...adminOnly,
  requireCsrf,
  adminRateLimit,
  adminController.deactivateUser
);

router.get("/messages", ...staff, adminRateLimit, adminController.listMessages);
router.delete(
  "/messages/:id",
  ...staff,
  requireCsrf,
  adminRateLimit,
  adminController.deleteMessage
);
router.patch(
  "/messages/:id",
  ...staff,
  requireCsrf,
  adminRateLimit,
  adminController.editMessage
);

router.get("/bad-words", ...staff, adminRateLimit, adminController.listBadWords);
router.post(
  "/bad-words",
  ...adminOnly,
  requireCsrf,
  adminRateLimit,
  adminController.createBadWord
);
router.patch(
  "/bad-words/:id",
  ...adminOnly,
  requireCsrf,
  adminRateLimit,
  adminController.updateBadWord
);
router.delete(
  "/bad-words/:id",
  ...adminOnly,
  requireCsrf,
  adminRateLimit,
  adminController.deleteBadWord
);

router.get("/audit-logs", ...staff, adminRateLimit, adminController.listAuditLogs);

module.exports = router;