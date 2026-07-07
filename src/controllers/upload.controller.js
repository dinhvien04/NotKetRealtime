const config = require("../config/env");
const uploadModel = require("../models/upload.model");
const { getSupabaseError } = require("../services/supabase.service");
const { uploadChatFile } = require("../services/storage.service");
const { getMaxBytesForKind } = require("../utils/mime");

function parseDurationMs(value) {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }
  return Math.round(duration);
}

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

  const kind = typeof req.body?.kind === "string" ? req.body.kind.trim() : null;
  const durationMs = parseDurationMs(req.body?.durationMs);

  if (kind === "voice") {
    if (!durationMs) {
      return res.status(400).json({
        ok: false,
        error: "Voice message cần durationMs hợp lệ."
      });
    }
    const maxDurationMs = config.maxVoiceSeconds * 1000;
    if (durationMs > maxDurationMs) {
      return res.status(400).json({
        ok: false,
        error: `Voice message vượt quá ${config.maxVoiceSeconds} giây.`
      });
    }
  }

  try {
    const fileMeta = await uploadChatFile({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      senderId: sender.id,
      kind
    });

    if (req.file.size > getMaxBytesForKind(fileMeta.kind)) {
      return res.status(400).json({
        ok: false,
        error: "File vượt quá giới hạn cho loại upload này."
      });
    }

    const pendingMeta = {
      ...fileMeta,
      durationMs: kind === "voice" ? durationMs : null
    };

    uploadModel.addPendingUpload(sender.id, pendingMeta);

    return res.json({ ok: true, file: pendingMeta });
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