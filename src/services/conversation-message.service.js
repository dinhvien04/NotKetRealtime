const messageModel = require("../models/message.model");
const uploadModel = require("../models/upload.model");
const conversationRepository = require("../repositories/conversation.repository");
const { sanitizeMessage } = require("../utils/sanitize");

const publicRateLimits = new Map();
const PUBLIC_MESSAGES_PER_MINUTE = 30;

function checkPublicRateLimit(userId) {
  const now = Date.now();
  const entry = publicRateLimits.get(userId) || {
    count: 0,
    resetAt: now + 60000
  };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 60000;
  }

  entry.count += 1;
  publicRateLimits.set(userId, entry);

  if (entry.count > PUBLIC_MESSAGES_PER_MINUTE) {
    throw new Error("Quá nhiều tin nhắn public. Vui lòng thử lại sau.");
  }
}

function buildMessagePayload(user, payload = {}) {
  const messageType = payload.type || "text";

  if (messageType === "text") {
    const content = sanitizeMessage(payload.message || payload.text);
    if (!content) {
      throw new Error("Không thể gửi tin nhắn trống.");
    }
    return {
      type: "text",
      message: content,
      replyToMessageId: payload.replyToMessageId || null
    };
  }

  if (messageType === "image" || messageType === "file" || messageType === "voice") {
    const pendingUpload = uploadModel.consumePendingUpload(
      user.id,
      payload.fileKey
    );

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

    return {
      type: pendingUpload.kind,
      fileUrl: pendingUpload.fileUrl,
      fileKey: pendingUpload.fileKey,
      fileName: pendingUpload.fileName,
      mimeType: pendingUpload.mimeType,
      size: pendingUpload.size,
      durationMs: pendingUpload.durationMs || null,
      replyToMessageId: payload.replyToMessageId || null
    };
  }

  throw new Error("Loại tin nhắn không được hỗ trợ.");
}

async function sendRoomMessage({ user, conversationId, payload, expectedType }) {
  const conversation = await conversationRepository.getById(conversationId);
  if (!conversation || conversation.type !== expectedType) {
    throw new Error("Hội thoại không tồn tại hoặc không hợp lệ.");
  }

  const allowed = await conversationRepository.canAccessConversation(
    conversationId,
    user.id
  );
  if (!allowed) {
    throw new Error("Bạn không có quyền gửi tin nhắn trong hội thoại này.");
  }

  if (expectedType === "public") {
    checkPublicRateLimit(user.id);
  }

  const messagePayload = buildMessagePayload(user, payload);
  const message = await messageModel.createMessage({
    conversationId,
    senderId: user.id,
    senderName: user.displayName || user.username,
    receiverId: null,
    payload: messagePayload
  });

  await conversationRepository.touchConversation(conversationId);

  return {
    conversation,
    message: {
      ...message,
      conversationId
    }
  };
}

module.exports = {
  sendRoomMessage,
  buildMessagePayload,
  checkPublicRateLimit
};