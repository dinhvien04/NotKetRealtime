const uploadService = require("../services/upload.service");
const documentMessageService = require("../services/document-message.service");

async function sign(req, res) {
  try {
    const { fileName, mimeType, size, kind } = req.body || {};
    const upload = await uploadService.signUpload({
      fileName,
      mimeType,
      size,
      kind
    });
    return res.json({ ok: true, upload });
  } catch (error) {
    return res.status(error.status || 400).json({
      ok: false,
      error: error.message || "Không thể tạo URL upload."
    });
  }
}

async function refreshUrl(req, res) {
  try {
    const { fileKey } = req.body || {};
    const result = await documentMessageService.refreshFileUrl(fileKey);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(error.status || 400).json({
      ok: false,
      error: error.message || "Không thể làm mới URL."
    });
  }
}

module.exports = {
  sign,
  refreshUrl
};
