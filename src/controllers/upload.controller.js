const uploadModel = require("../models/upload.model");
const { getSupabaseError } = require("../services/supabase.service");
const { uploadChatFile } = require("../services/storage.service");

async function uploadFile(req, res) {
  const configError = getSupabaseError();
  if (configError) {
    return res.status(503).json({ ok: false, error: configError });
  }

  const sender = req.user;
  if (!sender?.id) {
    return res.status(401).json({ ok: false, error: "Bạn cần đăng nhập." });
  }

  if (!req.file) {
    return res.status(400).json({ ok: false, error: "Thiếu file upload." });
  }

  try {
    const fileMeta = await uploadChatFile({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      senderId: sender.id
    });

    uploadModel.addPendingUpload(sender.id, fileMeta);

    return res.json({ ok: true, file: fileMeta });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể upload file."
    });
  }
}

module.exports = {
  uploadFile
};