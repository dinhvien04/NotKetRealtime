const config = require("../config/env");
const { ALLOWED_MIME_TYPES } = require("../utils/mime");

function getConfig(req, res) {
  return res.json({
    ok: true,
    openMode: config.appOpenMode,
    maxUploadBytes: config.maxUploadBytes,
    maxImageBytes: config.maxImageBytes,
    maxFileBytes: config.maxFileBytes,
    storageLimitBytes: config.storageLimitBytes,
    allowedMimeTypes: [...ALLOWED_MIME_TYPES]
  });
}

module.exports = {
  getConfig
};
