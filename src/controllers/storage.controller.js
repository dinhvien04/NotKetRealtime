const documentMessageService = require("../services/document-message.service");
const uploadService = require("../services/upload.service");

async function usage(req, res) {
  try {
    const result = await documentMessageService.getStorageUsage();
    const recent = await documentMessageService.getRecentMedia();
    return res.json({ ok: true, ...result, ...recent });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      error: error.message || "Không thể lấy dung lượng."
    });
  }
}

/** Optional protected cleanup of expired pending uploads + orphan S3 objects. */
async function cleanup(req, res) {
  try {
    const limit = req.body?.limit != null ? Number(req.body.limit) : 20;
    const result = await uploadService.cleanupExpiredUploads({ limit });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      error: error.message || "Không thể dọn pending uploads."
    });
  }
}

module.exports = {
  usage,
  cleanup
};
