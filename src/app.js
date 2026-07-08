const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const config = require("./config/env");
const webRoutes = require("./routes/web.routes");
const authRoutes = require("./routes/auth.routes");
const uploadRoutes = require("./routes/upload.routes");
const userRoutes = require("./routes/user.routes");
const messageRoutes = require("./routes/message.routes");
const conversationRoutes = require("./routes/conversation.routes");
const adminRoutes = require("./routes/admin.routes");
const healthRoutes = require("./routes/health.routes");
const aiRoutes = require("./routes/ai.routes");
const csrfRoutes = require("./routes/csrf.routes");
const iconRoutes = require("./routes/icon.routes");
const requestLoggingMiddleware = require("./middlewares/request-logging.middleware");
const { requireSameOriginFetch } = require("./middlewares/sec-fetch.middleware");

function getOrigin(value) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch (_error) {
    return null;
  }
}

function getWsOrigin(value) {
  if (!value) return null;
  try {
    const u = new URL(value);
    const proto = u.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${u.host}`;
  } catch (_error) {
    return null;
  }
}

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
    sources.add(`https://${config.s3Bucket}.s3.${config.s3Region}.amazonaws.com`);
  }

  return [...sources];
}

function buildConnectSrc() {
  const sources = new Set(["'self'"]);

  // CLIENT_ORIGIN(s)
  for (const origin of config.clientOrigins || []) {
    const httpOrigin = getOrigin(origin);
    if (httpOrigin) sources.add(httpOrigin);
    const wsOrigin = getWsOrigin(origin);
    if (wsOrigin) sources.add(wsOrigin);
  }

  // APP_BASE_URL
  const appOrigin = getOrigin(config.appBaseUrl);
  if (appOrigin) {
    sources.add(appOrigin);
  }
  const appWs = getWsOrigin(config.appBaseUrl);
  if (appWs) sources.add(appWs);

  // S3 / public / endpoint
  getS3ConnectSrc().forEach((s) => sources.add(s));

  // Iconify APIs
  sources.add("https://api.iconify.design");
  sources.add("https://api.simplesvg.com");
  sources.add("https://api.unisvg.com");

  if (!config.isProduction) {
    // Dev: allow generic for easy local ws + localhost variants
    sources.add("ws:");
    sources.add("wss:");
    sources.add("http://localhost:3000");
    sources.add("http://127.0.0.1:3000");
    sources.add("ws://localhost:3000");
    sources.add("ws://127.0.0.1:3000");
    sources.add("wss://localhost:3000");
    sources.add("wss://127.0.0.1:3000");
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
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://code.iconify.design"],
        connectSrc: buildConnectSrc(),
        styleSrc: ["'self'", "'unsafe-inline'"]
      }
    }
  })
);
app.use(requestLoggingMiddleware);
app.use(requireSameOriginFetch);
app.use(cookieParser());
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/health", healthRoutes);
app.use("/api", csrfRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/icons", iconRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/", webRoutes);

app.use((error, req, res, next) => {
  if (!error) {
    return next();
  }

  if (req.path.startsWith("/api/")) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        ok: false,
        error: `File vượt quá giới hạn ${Math.round(config.maxUploadBytes / 1024 / 1024)}MB.`
      });
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        ok: false,
        error: "Chỉ được upload một file mỗi lần."
      });
    }

    const message = error.message || "Không thể xử lý yêu cầu.";
    return res.status(400).json({ ok: false, error: message });
  }

  return next(error);
});

app.use((error, req, res, next) => {
  if (!error || !req.path.startsWith("/api/")) {
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