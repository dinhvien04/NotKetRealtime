const config = require("../config/env");
const messageRepository = require("../repositories/message.repository");
const reactionRepository = require("../repositories/reaction.repository");
const conversationRepository = require("../repositories/conversation.repository");
const userRepository = require("../repositories/user.repository");
const auditService = require("./audit.service");
const badWordService = require("./bad-word.service");
const { sanitizeMessage } = require("../utils/sanitize");
const { isAllowedReaction } = require("../utils/emoji");

function isStaff(userRow) {
  return userRow?.role === "admin" || userRow?.role === "moderator";
}

function canEditMessage(messageRow, actorRow) {
  if (!messageRow || messageRow.deleted_at) return false;
  if (messageRow.type !== "text") return false;

  if (isStaff(actorRow)) return true;
  if (messageRow.sender_id !== actorRow.id) return false;

  const createdAt = new Date(messageRow.created_at).getTime();
  const windowMs = config.messageEditWindowMinutes * 60 * 1000;
  return Date.now() - createdAt <= windowMs;
}

function canDeleteMessage(messageRow, actorRow) {
  if (!messageRow || messageRow.deleted_at) return false;
  if (isStaff(actorRow)) return true;
  return messageRow.sender_id === actorRow.id;
}

async function assertParticipant(conversationId, userId) {
  const allowed = await conversationRepository.canAccessConversation(
    conversationId,
    userId
  );
  if (!allowed) {
    throw new Error("Bạn không có quyền truy cập hội thoại này.");
  }
}

async function validateReplyMessage(conversationId, replyToMessageId) {
  if (!replyToMessageId) return null;

  const replyMessage = await messageRepository.findRawById(replyToMessageId);
  if (!replyMessage || replyMessage.deleted_at) {
    throw new Error("Tin nhắn được trả lời không tồn tại.");
  }
  if (replyMessage.conversation_id !== conversationId) {
    throw new Error("Tin nhắn được trả lời không thuộc hội thoại này.");
  }
  return replyToMessageId;
}

async function getMessageForActor(messageId, actorId) {
  const message = await messageRepository.findRawById(messageId);
  if (!message) {
    throw new Error("Tin nhắn không tồn tại.");
  }

  const actor = await userRepository.findById(actorId);
  if (!actor) {
    throw new Error("Người dùng không tồn tại.");
  }

  await assertParticipant(message.conversation_id, actorId);
  return { message, actor };
}

async function editMessage(actorId, messageId, body, req = null) {
  const sanitized = sanitizeMessage(body);
  if (!sanitized) {
    throw new Error("Nội dung tin nhắn không hợp lệ.");
  }

  const { message, actor } = await getMessageForActor(messageId, actorId);
  if (!canEditMessage(message, actor)) {
    throw new Error("Bạn không có quyền chỉnh sửa tin nhắn này.");
  }

  const filtered = await badWordService.applyTextFilter(sanitized, {
    auditContext: {
      actorId: actor.id,
      actorRole: actor.role,
      req
    }
  });

  const updated = await messageRepository.editMessage(messageId, filtered.text);
  const isAdminAction = isStaff(actor) && message.sender_id !== actor.id;

  if (isAdminAction) {
    await auditService.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: "message.edit",
      targetType: "message",
      targetId: messageId,
      details: { conversationId: message.conversation_id },
      req
    });
  }

  return updated;
}

async function deleteMessage(actorId, messageId, req = null) {
  const { message, actor } = await getMessageForActor(messageId, actorId);
  if (!canDeleteMessage(message, actor)) {
    throw new Error("Bạn không có quyền xóa tin nhắn này.");
  }

  const deleted = await messageRepository.softDeleteMessage(messageId, actor.id);
  const isAdminAction = isStaff(actor) && message.sender_id !== actor.id;

  if (isAdminAction) {
    await auditService.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: "message.delete",
      targetType: "message",
      targetId: messageId,
      details: { conversationId: message.conversation_id },
      req
    });
  }

  return deleted;
}

async function addReaction(actorId, messageId, emoji, req = null) {
  if (!isAllowedReaction(emoji)) {
    throw new Error("Emoji reaction không được hỗ trợ.");
  }

  const { message } = await getMessageForActor(messageId, actorId);
  if (message.deleted_at) {
    throw new Error("Không thể react tin nhắn đã xóa.");
  }

  await reactionRepository.addReaction({
    messageId,
    userId: actorId,
    emoji: emoji.trim()
  });

  return messageRepository.findById(messageId);
}

async function removeReaction(actorId, messageId, emoji) {
  if (!isAllowedReaction(emoji)) {
    throw new Error("Emoji reaction không được hỗ trợ.");
  }

  await getMessageForActor(messageId, actorId);
  await reactionRepository.removeReaction({
    messageId,
    userId: actorId,
    emoji: emoji.trim()
  });

  return messageRepository.findById(messageId);
}

async function searchMessages(actorId, options = {}) {
  const { conversationId } = options;
  if (!conversationId) {
    throw new Error("Thiếu conversationId.");
  }

  await assertParticipant(conversationId, actorId);

  const queryText = typeof options.q === "string" ? options.q.trim() : "";
  if (!queryText && !options.type) {
    throw new Error("Cần từ khóa tìm kiếm hoặc bộ lọc loại tin nhắn.");
  }

  return messageRepository.searchInConversation({
    conversationId,
    queryText,
    type: options.type || null,
    fromDate: options.from || null,
    toDate: options.to || null,
    limit: options.limit,
    cursor: options.cursor || null
  });
}

module.exports = {
  validateReplyMessage,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  searchMessages,
  canEditMessage,
  canDeleteMessage
};