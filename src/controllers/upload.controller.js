const config = require("../config/env");
const uploadModel = require("../models/upload.model");
const attachmentRepository = require("../repositories/attachment.repository");
const auditService = require("../services/audit.service");
const { getStorageConfigError } = require("../services/s3.service");
const {
  createPresignedUpload,
  resolveFileUrl
} = require("../services/storage.service");
const { isAllowedMimeType, getKindFromMimeType } = require("../utils/mime");

function parseDurationMs(value) {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }
  return Math.round(duration);
}

async function logUploadRejection(req, sender, reason, details = {}) {
  try {
    await auditService.log({
      actorId: sender?.id || null,
      actorRole: sender?.role || null,
      action: "upload_rejected",
      targetType: "file",
      details: {
        reason,
        fileName: details.fileName || null,
        mimeType: details.mimeType || null
      },
      req
    });
  } catch (_error) {
    // audit failure should not block response
  }
}

function parseSignBody(body = {}) {
  const fileName =
    typeof body.fileName === "string" ? body.fileName.trim() : "";
  const mimeType =
    typeof body.mimeType === "string" ? body.mimeType.trim() : "";
  const size = Number(body.size);
  const kind = typeof body.kind === "string" ? body.kind.trim() : null;
  const durationMs =
    body.durationMs === null || body.durationMs === undefined
      ? null
      : parseDurationMs(body.durationMs);

  return { fileName, mimeType, size, kind, durationMs };
}

async function signUpload(req, res) {
  const configError = getStorageConfigError();
  if (configError) {
    return res.status(503).json({ ok: false, error: configError });
  }

  const sender = req.user;
  if (!sender?.id) {
    return res.status(401).json({ ok: false, error: "Bạn cần đăng nhập." });
  }

  const { fileName, mimeType, size, kind, durationMs } = parseSignBody(req.body);

  if (!fileName || !mimeType || !Number.isFinite(size) || size <= 0) {
    await logUploadRejection(req, sender, "Metadata upload không hợp lệ.", {
      fileName,
      mimeType
    });
    return res.status(400).json({
      ok: false,
      error: "Metadata upload không hợp lệ."
    });
  }

  if (!isAllowedMimeType(mimeType)) {
    await logUploadRejection(req, sender, "Loại file không được hỗ trợ.", {
      fileName,
      mimeType
    });
    return res.status(400).json({
      ok: false,
      error: "Loại file không được hỗ trợ."
    });
  }

  const resolvedKind = getKindFromMimeType(mimeType, kind);
  if (kind && kind !== resolvedKind) {
    await logUploadRejection(req, sender, "Kind không khớp MIME type.", {
      fileName,
      mimeType
    });
    return res.status(400).json({
      ok: false,
      error: "Kind không khớp MIME type."
    });
  }

  try {
    const upload = await createPresignedUpload({
      originalName: fileName,
      mimeType,
      size,
      senderId: sender.id,
      kind: resolvedKind,
      durationMs
    });

    const pendingMeta = {
      fileKey: upload.fileKey,
      fileName: upload.fileName,
      mimeType: upload.mimeType,
      size: upload.size,
      kind: upload.kind,
      durationMs: upload.durationMs,
      status: "signed",
      expiresAt: new Date(
        Date.now() + upload.expiresIn * 1000
      ).toISOString()
    };

    await attachmentRepository.createPending({
      uploaderId: sender.id,
      bucket: config.s3Bucket,
      fileKey: upload.fileKey,
      fileUrl: null,
      fileName: upload.fileName,
      mimeType: upload.mimeType,
      fileSize: upload.size,
      kind: upload.kind,
      durationMs: upload.durationMs,
      metadata: { status: "signed" }
    });

    uploadModel.addPendingUpload(sender.id, pendingMeta);

    return res.json({ ok: true, upload });
  } catch (error) {
    await logUploadRejection(req, sender, error.message || "Không thể ký URL upload.", {
      fileName,
      mimeType
    });
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể ký URL upload."
    });
  }
}

async function uploadFile(req, res) {
  return res.status(410).json({
    ok: false,
    error: "Endpoint đã ngừng hỗ trợ. Dùng POST /api/uploads/sign."
  });
}

async function refreshFileUrl(req, res) {
  const configError = getStorageConfigError();
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

    if (!config.s3PublicBaseUrl) {
      payload.expiresAt = new Date(
        Date.now() + config.s3SignedUrlTtlSeconds * 1000
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
  signUpload,
  uploadFile,
  refreshFileUrl
};