const multer = require("multer");
const config = require("../config/env");

const ALLOWED_AVATAR_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: config.maxAvatarBytes
  },
  fileFilter(req, file, callback) {
    if (!ALLOWED_AVATAR_MIME.has(file.mimetype)) {
      callback(new Error("Chỉ hỗ trợ ảnh JPEG, PNG, WebP hoặc GIF."));
      return;
    }
    callback(null, true);
  }
});

module.exports = upload.single("avatar");