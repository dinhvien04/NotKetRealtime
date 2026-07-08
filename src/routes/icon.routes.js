const express = require("express");
const rateLimit = require("express-rate-limit");
const iconController = require("../controllers/icon.controller");
const { requireAuth } = require("../middlewares/auth.middleware");
const { requireCsrf } = require("../middlewares/csrf.middleware");

const router = express.Router();

const iconSearchRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Quá nhiều yêu cầu tìm icon. Vui lòng thử lại sau." }
});

router.get("/config", requireAuth, iconController.getConfig);
router.get("/recent", requireAuth, iconController.getRecent);
router.post("/recent", requireAuth, requireCsrf, iconController.saveRecent);
router.get("/search", requireAuth, iconSearchRateLimit, iconController.search);

module.exports = router;