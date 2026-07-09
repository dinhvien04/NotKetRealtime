const documentUploadRepo = require("../repositories/document-upload.repository");
const documentMessageRepo = require("../repositories/document-message.repository");
const storageService = require("./storage.service");
const config = require("../config/env");

async function signUpload({ fileName, mimeType, size, kind }) {
  const used = await documentMessageRepo.getStorageUsage();
  if (used + Number(size) > config.storageLimitBytes) {
    const error = new Error("Đã vượt giới hạn dung lượng lưu trữ.");
    error.status = 400;
    throw error;
  }

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
  signUpload
};
