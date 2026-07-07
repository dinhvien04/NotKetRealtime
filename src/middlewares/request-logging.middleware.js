const crypto = require("crypto");
const logger = require("../utils/logger");

function requestLoggingMiddleware(req, res, next) {
  const requestId = crypto.randomBytes(8).toString("hex");
  const startedAt = Date.now();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    logger[level]("HTTP request", {
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs
    });
  });

  next();
}

module.exports = requestLoggingMiddleware;