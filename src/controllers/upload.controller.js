const config = require("../config/env");
const uploadModel = require("../models/upload.model");
const attachmentRepository = require("../repositories/attachment.repository");
const auditService = require("../services/audit.service");
const { getSupabaseError } = require("../services/supabase.service");
const { uploadChatFile, resolveFileUrl } = require("../services/storage.service");
const { getMaxBytesForKind } = require("../utils/mime");
function parseDurationMs(value) {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }
  return Math.round(duration);
}

async function logUploadRejection(req, sender, reason) {
  try {
    await auditService.log({
      actorId: sender?.id || null,
      actorRole: sender?.role || null,
      action: "upload_rejected",
      targetType: "file",
      details: {
        reason,
        fileName: req.file?.originalname || null,
        mimeType: req.file?.mimetype || null
      },
      req
    });
  } catch (_error) {
    // audit failure should not block response
  }
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
    await logUploadRejection(req, sender, "Thiếu file upload.");
    return res.status(400).json({ ok: false, error: "Thiếu file upload." });
  }

  const kind = typeof req.body?.kind === "string" ? req.body.kind.trim() : null;
  const durationMs = parseDurationMs(req.body?.durationMs);

  if (kind === "voice") {
    if (!durationMs) {
      await logUploadRejection(req, sender, "Voice message cần durationMs hợp lệ.");
      return res.status(400).json({
        ok: false,
        error: "Voice message cần durationMs hợp lệ."
      });
    }
    const maxDurationMs = config.maxVoiceSeconds * 1000;
    if (durationMs > maxDurationMs) {
      await logUploadRejection(req, sender, `Voice message vượt quá ${config.maxVoiceSeconds} giây.`);
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
      await logUploadRejection(req, sender, "File vượt quá giới hạn cho loại upload này.");
      return res.status(400).json({
        ok: false,
        error: "File vượt quá giới hạn cho loại upload này."
      });
    }

    const pendingMeta = {
      ...fileMeta,
      durationMs: kind === "voice" ? durationMs : null
    };

    await attachmentRepository.createPending({
      uploaderId: sender.id,
      bucket: config.supabaseStorageBucket,
      fileKey: fileMeta.fileKey,
      fileUrl: config.supabaseStoragePublic ? fileMeta.fileUrl : null,
      fileName: fileMeta.fileName,
      mimeType: fileMeta.mimeType,
      fileSize: fileMeta.size,
      kind: fileMeta.kind,
      durationMs: pendingMeta.durationMs
    });

    uploadModel.addPendingUpload(sender.id, pendingMeta);

    return res.json({ ok: true, file: pendingMeta });
  } catch (error) {
    await logUploadRejection(req, sender, error.message || "Không thể upload file.");
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể upload file."
    });
  }
}

async function refreshFileUrl(req, res) {
  const configError = getSupabaseError();
  if (configError) {
    return res.status(503).json({ ok: false, error: configError });
  }

  const sender = req.user;
  if (!sender?.id) {
    return res.status(401).json({ ok: false, error: "Bạn cần đăng nhập." });
  }

  const fileKey =
    typeof req.body?.fileKey === "string" ? req.body.fileKey.trim() : "";
  if (!fileKey) {
    return res.status(400).json({ ok: false, error: "Thiếu fileKey." });
  }

  try {
    const allowed = await attachmentRepository.userCanAccessFileKey(
      fileKey,
      sender.id
    );
    if (!allowed) {
      return res.status(403).json({
        ok: false,
        error: "Bạn không có quyền truy cập file này."
      });
    }

    const fileUrl = await resolveFileUrl(fileKey);
    const payload = { ok: true, fileKey, fileUrl };

    if (!config.supabaseStoragePublic) {
      payload.expiresAt = new Date(
        Date.now() + config.signedUrlTtlSeconds * 1000
      ).toISOString();
    }

    return res.json(payload);
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể làm mới URL file."
    });
  }
}

module.exports = {
  uploadFile,
  refreshFileUrl
};