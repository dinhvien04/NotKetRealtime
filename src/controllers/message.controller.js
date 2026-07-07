const messageService = require("../services/message.service");
const realtimeService = require("../services/realtime.service");
const { getDatabaseError } = require("../db");

async function editMessage(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const message = await messageService.editMessage(
      req.user.id,
      req.params.id,
      req.body?.body ?? req.body?.message ?? req.body?.text,
      req
    );
    await realtimeService.emitToConversation(message.conversationId, "message_edited", {
      conversationId: message.conversationId,
      message
    });
    return res.json({ ok: true, message });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể chỉnh sửa tin nhắn."
    });
  }
}

async function deleteMessage(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const message = await messageService.deleteMessage(
      req.user.id,
      req.params.id,
      req
    );
    await realtimeService.emitToConversation(message.conversationId, "message_deleted", {
      conversationId: message.conversationId,
      message
    });
    return res.json({ ok: true, message });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể xóa tin nhắn."
    });
  }
}

async function addReaction(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const message = await messageService.addReaction(
      req.user.id,
      req.params.id,
      req.body?.emoji,
      req
    );
    await realtimeService.emitToConversation(
      message.conversationId,
      "message_reaction_added",
      {
        conversationId: message.conversationId,
        messageId: message.id,
        emoji: String(req.body?.emoji || "").trim(),
        userId: req.user.id,
        reactions: message.reactions
      }
    );
    return res.json({ ok: true, message });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể thêm reaction."
    });
  }
}

async function removeReaction(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const message = await messageService.removeReaction(
      req.user.id,
      req.params.id,
      req.body?.emoji
    );
    await realtimeService.emitToConversation(
      message.conversationId,
      "message_reaction_removed",
      {
        conversationId: message.conversationId,
        messageId: message.id,
        emoji: String(req.body?.emoji || "").trim(),
        userId: req.user.id,
        reactions: message.reactions
      }
    );
    return res.json({ ok: true, message });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể gỡ reaction."
    });
  }
}

async function searchMessages(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const result = await messageService.searchMessages(req.user.id, {
      conversationId: req.query.conversationId,
      q: req.query.q,
      type: req.query.type,
      from: req.query.from,
      to: req.query.to,
      limit: req.query.limit,
      cursor: req.query.cursor
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể tìm kiếm tin nhắn."
    });
  }
}

module.exports = {
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  searchMessages
};