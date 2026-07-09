const documentUploadRepo = require("../repositories/document-upload.repository");
const documentMessageRepo = require("../repositories/document-message.repository");
const storageService = require("./storage.service");
const config = require("../config/env");

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

async function signUpload({ fileName, mimeType, size, kind }) {
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
  assertWithinStorageQuota
};
