const documentUploadRepo = require("../repositories/document-upload.repository");
const documentMessageRepo = require("../repositories/document-message.repository");
const storageService = require("./storage.service");
const config = require("../config/env");
const logger = require("../utils/logger");

async function assertWithinStorageQuota(additionalBytes) {
  await documentUploadRepo.expireOldUploads();
  const usedBytes = await documentMessageRepo.getStorageUsage();
  const pendingBytes = await documentUploadRepo.getPendingUploadBytes();
  const total = usedBytes + pendingBytes + Number(additionalBytes || 0);

  if (total > config.storageLimitBytes) {
    const error = new Error(
      "Đã vượt giới hạn dung lượng lưu trữ (bao gồm upload đang chờ)."
    );
    error.status = 400;
    error.usedBytes = usedBytes;
    error.pendingBytes = pendingBytes;
    error.limitBytes = config.storageLimitBytes;
    throw error;
  }

  return { usedBytes, pendingBytes };
}

/**
 * Light cleanup of expired pending uploads (bounded).
 * Deletes S3 object only when no document_messages row references the file_key.
 */
async function cleanupExpiredUploads({ limit = 20 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 20);
  const expired = await documentUploadRepo.listExpiredPendingUploads(safeLimit);
  let deletedObjects = 0;
  let markedExpired = 0;

  for (const upload of expired) {
    const fileKey = upload.fileKey;
    if (!fileKey) continue;

    try {
      const hasMessage = await documentMessageRepo.hasAnyMessageWithFileKey(fileKey);
      if (!hasMessage) {
        try {
          await storageService.deleteObject(fileKey);
          deletedObjects += 1;
        } catch (error) {
          logger.warn("cleanupExpiredUploads: deleteObject failed", {
            fileKey,
            error: error?.message || String(error)
          });
        }
      }

      const marked = await documentUploadRepo.markExpired(fileKey);
      if (marked) markedExpired += 1;
    } catch (error) {
      logger.warn("cleanupExpiredUploads: item failed", {
        fileKey,
        error: error?.message || String(error)
      });
    }
  }

  return {
    scanned: expired.length,
    deletedObjects,
    markedExpired
  };
}

async function signUpload({ fileName, mimeType, size, kind }) {
  // Bounded light cleanup — never block sign on cleanup failures
  try {
    await cleanupExpiredUploads({ limit: 20 });
  } catch (error) {
    logger.warn("signUpload: cleanupExpiredUploads failed", {
      error: error?.message || String(error)
    });
  }

  await assertWithinStorageQuota(size);

  const upload = await storageService.createPresignedUpload({
    originalName: fileName,
    mimeType,
    size: Number(size),
    kind
  });

  const expiresAt = new Date(Date.now() + upload.expiresIn * 1000);

  await documentUploadRepo.createPendingUpload({
    fileKey: upload.fileKey,
    fileName: upload.fileName,
    mimeType: upload.mimeType,
    fileSize: upload.size,
    kind: upload.kind,
    expiresAt
  });

  return upload;
}

module.exports = {
  signUpload,
  assertWithinStorageQuota,
  cleanupExpiredUploads
};
