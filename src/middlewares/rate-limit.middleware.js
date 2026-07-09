const rateLimit = require("express-rate-limit");

const uploadSignLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: "Quá nhiều yêu cầu upload. Thử lại sau."
  }
});

const messageWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: "Quá nhiều yêu cầu ghi. Thử lại sau."
  }
});

const messageReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: "Quá nhiều yêu cầu đọc. Thử lại sau."
  }
});

module.exports = {
  uploadSignLimiter,
  messageWriteLimiter,
  messageReadLimiter
};
