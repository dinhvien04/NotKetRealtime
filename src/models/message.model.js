const config = require("../config/env");
const messageRepository = require("../repositories/message.repository");
const { isAllowedMimeType, getKindFromMimeType } = require("../utils/mime");
const { sanitizeFileName } = require("../utils/filename");

function normalizeType(type, mimeType) {
  if (type === "image" || type === "file" || type === "text") {
    return type;
  }
  if (mimeType) {
    return getKindFromMimeType(mimeType);
  }
  return "text";
}

function validateTextMessage(payload) {
  const text = (payload.message || payload.text || payload.body || "").trim();
  if (!text) {
    throw new Error("Không thể gửi tin nhắn trống.");
  }
  return text;
}

function validateFileMessage(payload) {
  const fileUrl = typeof payload.fileUrl === "string" ? payload.fileUrl.trim() : "";
  const fileKey = typeof payload.fileKey === "string" ? payload.fileKey.trim() : "";
  const fileName = sanitizeFileName(payload.fileName);
  const mimeType = typeof payload.mimeType === "string" ? payload.mimeType.trim() : "";
  const size = Number(payload.size);

  if (!fileUrl || !fileKey || !fileName || !mimeType || !Number.isFinite(size)) {
    throw new Error("Thiếu metadata file hợp lệ.");
  }

  if (size <= 0 || size > config.maxUploadBytes) {
    throw new Error("Kích thước file không hợp lệ.");
  }

  if (!isAllowedMimeType(mimeType)) {
    throw new Error("Loại file không được hỗ trợ.");
  }

  return {
    type: normalizeType(payload.type, mimeType),
    fileUrl,
    fileKey,
    fileName,
    mimeType,
    size
  };
}

async function createMessage({
  conversationId,
  senderId,
  senderName,
  receiverId,
  payload = {}
}) {
  const type = normalizeType(payload.type, payload.mimeType);

  if (type === "text") {
    const body = validateTextMessage(payload);
    return messageRepository.createMessage({
      conversationId,
      senderId,
      senderName,
      receiverId,
      type: "text",
      body
    });
  }

  const fileMeta = validateFileMessage({ ...payload, type });
  return messageRepository.createMessage({
    conversationId,
    senderId,
    senderName,
    receiverId,
    type: fileMeta.type,
    body: "",
    fileUrl: fileMeta.fileUrl,
    fileKey: fileMeta.fileKey,
    fileName: fileMeta.fileName,
    mimeType: fileMeta.mimeType,
    fileSize: fileMeta.size
  });
}

async function getMessagesForConversation(options) {
  return messageRepository.listByConversation(options);
}

module.exports = {
  createMessage,
  getMessagesForConversation,
  validateTextMessage,
  validateFileMessage
};