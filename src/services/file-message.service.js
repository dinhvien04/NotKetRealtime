const uploadModel = require("../models/upload.model");
const storageService = require("./storage.service");

async function buildVerifiedFileMessagePayload(user, payload = {}) {
  const messageType = payload.type;

  if (messageType !== "image" && messageType !== "file" && messageType !== "voice") {
    throw new Error("Loại tin nhắn không được hỗ trợ.");
  }

  const pendingUpload = uploadModel.getPendingUpload(user.id, payload.fileKey);

  if (!pendingUpload) {
    throw new Error("File chưa được upload hợp lệ hoặc đã hết hạn.");
  }

  if (
    pendingUpload.fileKey !== payload.fileKey ||
    pendingUpload.fileName !== payload.fileName ||
    pendingUpload.mimeType !== payload.mimeType ||
    Number(pendingUpload.size) !== Number(payload.size)
  ) {
    throw new Error("Metadata file không khớp với upload đã xác thực.");
  }

  if (
    pendingUpload.kind === "voice" &&
    Number(pendingUpload.durationMs) !== Number(payload.durationMs)
  ) {
    throw new Error("Thời lượng voice không khớp với upload đã xác thực.");
  }

  try {
    await storageService.verifyUploadedObject({
      fileKey: pendingUpload.fileKey,
      expectedSize: pendingUpload.size,
      expectedMimeType: pendingUpload.mimeType
    });
    await storageService.verifyUploadedObjectContent({
      fileKey: pendingUpload.fileKey,
      expectedMimeType: pendingUpload.mimeType,
      originalName: pendingUpload.fileName
    });
  } catch (_error) {
    throw new Error("File content không hợp lệ hoặc chưa upload xong.");
  }

  // Only consume after all validations (HEAD + content) pass.
  // If transient fail (e.g. GetObject temp error), pending stays for retry.
  uploadModel.consumePendingUpload(user.id, pendingUpload.fileKey);

  const fileUrl = await storageService.resolveFileUrl(pendingUpload.fileKey);

  return {
    type: pendingUpload.kind,
    fileUrl,
    fileKey: pendingUpload.fileKey,
    fileName: pendingUpload.fileName,
    mimeType: pendingUpload.mimeType,
    size: pendingUpload.size,
    durationMs: pendingUpload.durationMs || null,
    replyToMessageId: payload.replyToMessageId || null
  };
}

module.exports = {
  buildVerifiedFileMessagePayload
};