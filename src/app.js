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
const csrfRoutes = require("./routes/csrf.routes");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", "ws:", "wss:"],
        styleSrc: ["'self'", "'unsafe-inline'"]
      }
    }
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/api", csrfRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
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