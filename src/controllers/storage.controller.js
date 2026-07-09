const documentMessageService = require("../services/document-message.service");

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

module.exports = {
  usage
};
