const config = require("../config/env");
const messageRepository = require("../repositories/message.repository");
const messageService = require("../services/message.service");
const badWordService = require("../services/bad-word.service");
const {
  isAllowedMimeType,
  getKindFromMimeType,
  getMaxBytesForKind
} = require("../utils/mime");
const { sanitizeFileName } = require("../utils/filename");

function normalizeType(type, mimeType) {
  if (type === "image" || type === "file" || type === "text" || type === "voice") {
    return type;
  }
  if (mimeType) {
    return getKindFromMimeType(mimeType, type);
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

function validateVoiceDuration(durationMs) {
  const duration = Number(durationMs);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Thiếu thời lượng voice message.");
  }
  const maxDurationMs = config.maxVoiceSeconds * 1000;
  if (duration > maxDurationMs) {
    throw new Error(`Voice message vượt quá ${config.maxVoiceSeconds} giây.`);
  }
  return Math.round(duration);
}

function validateFileMessage(payload) {
  const fileUrl = typeof payload.fileUrl === "string" ? payload.fileUrl.trim() : "";
  const fileKey = typeof payload.fileKey === "string" ? payload.fileKey.trim() : "";
  const fileName = sanitizeFileName(payload.fileName);
  const mimeType = typeof payload.mimeType === "string" ? payload.mimeType.trim() : "";
  const size = Number(payload.size);
  const resolvedType = normalizeType(payload.type, mimeType);

  if (!fileUrl || !fileKey || !fileName || !mimeType || !Number.isFinite(size)) {
    throw new Error("Thiếu metadata file hợp lệ.");
  }

  const maxBytes = getMaxBytesForKind(resolvedType);
  if (size <= 0 || size > maxBytes) {
    throw new Error("Kích thước file không hợp lệ.");
  }

  if (!isAllowedMimeType(mimeType)) {
    throw new Error("Loại file không được hỗ trợ.");
  }

  const result = {
    type: resolvedType,
    fileUrl,
    fileKey,
    fileName,
    mimeType,
    size
  };

  if (resolvedType === "voice") {
    result.durationMs = validateVoiceDuration(payload.durationMs);
  }

  return result;
}

async function createMessage({
  conversationId,
  senderId,
  senderName,
  receiverId,
  payload = {}
}) {
  const type = normalizeType(payload.type, payload.mimeType);
  const replyToMessageId = await messageService.validateReplyMessage(
    conversationId,
    payload.replyToMessageId || null
  );

  if (type === "text") {
    const rawBody = validateTextMessage(payload);
    const filtered = await badWordService.applyTextFilter(rawBody, {
      auditContext: {
        actorId: senderId,
        actorRole: payload.actorRole || "user"
      }
    });
    return messageRepository.createMessage({
      conversationId,
      senderId,
      senderName,
      receiverId,
      type: "text",
      body: filtered.text,
      wasFiltered: filtered.wasFiltered,
      filterHits: filtered.hits,
      replyToMessageId
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
    fileSize: fileMeta.size,
    durationMs: fileMeta.durationMs || null,
    replyToMessageId
  });
}

async function getMessagesForConversation(options) {
  return messageRepository.listByConversation(options);
}

module.exports = {
  createMessage,
  getMessagesForConversation,
  validateTextMessage,
  validateFileMessage,
  validateVoiceDuration
};