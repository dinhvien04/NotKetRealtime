const express = require("express");
const helmet = require("helmet");
const path = require("path");
const config = require("./config/env");
const webRoutes = require("./routes/web.routes");
const appRoutes = require("./routes/app.routes");
const messageRoutes = require("./routes/document-message.routes");
const uploadRoutes = require("./routes/upload.routes");
const storageRoutes = require("./routes/storage.routes");
const healthRoutes = require("./routes/health.routes");
const appAccess = require("./middlewares/app-access.middleware");
const requestLoggingMiddleware = require("./middlewares/request-logging.middleware");
const { uploadSignLimiter } = require("./middlewares/rate-limit.middleware");

function getOrigin(value) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch (_error) {
    return null;
  }
}

/**
 * CSP connect-src for S3: only concrete bucket / endpoint origins.
 * Production never adds https://*.amazonaws.com wildcards.
 */
function getS3ConnectSrc() {
  const sources = new Set();

  const publicBaseOrigin = getOrigin(config.s3PublicBaseUrl);
  if (publicBaseOrigin) {
    sources.add(publicBaseOrigin);
  }

  const endpointOrigin = getOrigin(config.s3Endpoint);
  if (endpointOrigin) {
    sources.add(endpointOrigin);
  }

  if (!config.s3Endpoint && config.s3Bucket && config.s3Region && config.s3Region !== "auto") {
    // Virtual-hosted–style + path-style for the same region/bucket only (no *.amazonaws.com wildcards).
    sources.add(`https://${config.s3Bucket}.s3.${config.s3Region}.amazonaws.com`);
    sources.add(`https://s3.${config.s3Region}.amazonaws.com`);
  }

  return [...sources];
}

function buildConnectSrc() {
  const sources = new Set(["'self'"]);

  for (const origin of config.clientOrigins || []) {
    const httpOrigin = getOrigin(origin);
    if (httpOrigin) sources.add(httpOrigin);
  }

  const appOrigin = getOrigin(config.appBaseUrl);
  if (appOrigin) sources.add(appOrigin);

  getS3ConnectSrc().forEach((s) => sources.add(s));

  if (!config.isProduction) {
    sources.add("http://localhost:3000");
    sources.add("http://127.0.0.1:3000");
  }

  return [...sources];
}

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: buildConnectSrc(),
        styleSrc: ["'self'", "'unsafe-inline'"],
        mediaSrc: ["'self'", "blob:", "https:"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"]
      }
    }
  })
);
app.use(requestLoggingMiddleware);
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/", webRoutes);
app.use("/api/app", appRoutes);
app.use("/api/messages", appAccess, messageRoutes);
app.use("/api/uploads", appAccess, uploadSignLimiter, uploadRoutes);
app.use("/api/storage", appAccess, storageRoutes);
app.use("/health", healthRoutes);

app.use((error, req, res, next) => {
  if (!error) {
    return next();
  }

  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    const status = error.status || 400;
    return res.status(status).json({
      ok: false,
      error: error.message || "Không thể xử lý yêu cầu."
    });
  }

  return next(error);
});

app.use((error, req, res, next) => {
  if (!error || (!req.path.startsWith("/api/") && !req.path.startsWith("/health"))) {
    return next(error);
  }

  const status = error.status || 500;
  return res.status(status).json({
    ok: false,
    error: config.isProduction
      ? "Đã xảy ra lỗi máy chủ."
      : error.message || "Đã xảy ra lỗi máy chủ."
  });
});

module.exports = app;
module.exports.getS3ConnectSrc = getS3ConnectSrc;
