const multer = require("multer");
const config = require("../config/env");
const { isAllowedMimeType } = require("../utils/mime");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: Math.max(config.maxUploadBytes, config.maxVoiceBytes)
  },
  fileFilter(req, file, callback) {
    if (!isAllowedMimeType(file.mimetype)) {
      callback(new Error("Loại file không được hỗ trợ."));
      return;
    }
    callback(null, true);
  }
});

module.exports = upload.single("file");