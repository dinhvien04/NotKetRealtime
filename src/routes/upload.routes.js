const express = require("express");
const rateLimit = require("express-rate-limit");
const uploadMiddleware = require("../middlewares/upload.middleware");
const uploadController = require("../controllers/upload.controller");
const { requireAuth } = require("../middlewares/auth.middleware");
const { requireCsrf } = require("../middlewares/csrf.middleware");

const router = express.Router();

const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Quá nhiều yêu cầu upload. Vui lòng thử lại sau." }
});

router.post(
  "/",
  requireAuth,
  requireCsrf,
  uploadRateLimit,
  uploadMiddleware,
  uploadController.uploadFile
);

module.exports = router;