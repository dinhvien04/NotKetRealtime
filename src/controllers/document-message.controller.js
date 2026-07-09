const documentMessageService = require("../services/document-message.service");

async function list(req, res) {
  try {
    const { cursor, limit, q, type } = req.query;
    const result = await documentMessageService.listMessages({
      cursor: cursor || null,
      limit: limit ? Number(limit) : undefined,
      q: q || "",
      type: type || "all"
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      error: error.message || "Không thể tải tin nhắn."
    });
  }
}

async function createText(req, res) {
  try {
    const { type, body } = req.body || {};
    if (type && type !== "text") {
      return res.status(400).json({ ok: false, error: "type phải là text." });
    }
    const message = await documentMessageService.createTextMessage(body);
    return res.status(201).json({ ok: true, message });
  } catch (error) {
    return res.status(error.status || 400).json({
      ok: false,
      error: error.message || "Không thể tạo tin nhắn."
    });
  }
}

async function createFile(req, res) {
  try {
    const message = await documentMessageService.createFileMessage(req.body || {});
    return res.status(201).json({ ok: true, message });
  } catch (error) {
    return res.status(error.status || 400).json({
      ok: false,
      error: error.message || "Không thể lưu file."
    });
  }
}

async function remove(req, res) {
  try {
    const message = await documentMessageService.softDelete(req.params.id);
    return res.json({ ok: true, message });
  } catch (error) {
    return res.status(error.status || 400).json({
      ok: false,
      error: error.message || "Không thể xóa tin nhắn."
    });
  }
}

module.exports = {
  list,
  createText,
  createFile,
  remove
};
