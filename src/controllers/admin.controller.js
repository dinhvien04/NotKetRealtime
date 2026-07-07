const adminService = require("../services/admin.service");
const badWordService = require("../services/bad-word.service");
const realtimeService = require("../services/realtime.service");
const { getDatabaseError } = require("../db");

async function getStats(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const stats = await adminService.getStats(req.user);
    return res.json({ ok: true, stats });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể tải thống kê."
    });
  }
}

async function listUsers(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const result = await adminService.listUsers(req.user, {
      q: req.query.q,
      status: req.query.status,
      role: req.query.role,
      page: req.query.page,
      pageSize: req.query.pageSize
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể tải danh sách người dùng."
    });
  }
}

async function updateUser(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const user = await adminService.updateUser(
      req.user,
      req.params.id,
      {
        displayName: req.body?.displayName,
        role: req.body?.role,
        status: req.body?.status,
        isLocked: req.body?.isLocked,
        lockedReason: req.body?.lockedReason
      },
      req
    );
    return res.json({ ok: true, user });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể cập nhật người dùng."
    });
  }
}

async function deactivateUser(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const user = await adminService.deactivateUser(req.user, req.params.id, req);
    return res.json({ ok: true, user });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể vô hiệu hóa người dùng."
    });
  }
}

async function listMessages(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const result = await adminService.listMessages(req.user, {
      q: req.query.q,
      conversationId: req.query.conversationId,
      userId: req.query.userId,
      type: req.query.type,
      page: req.query.page,
      pageSize: req.query.pageSize
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể tải tin nhắn."
    });
  }
}

async function deleteMessage(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const message = await adminService.deleteMessage(
      req.user,
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

async function editMessage(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const message = await adminService.editMessage(
      req.user,
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

async function listBadWords(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const result = await badWordService.listBadWords({
      q: req.query.q,
      page: req.query.page,
      pageSize: req.query.pageSize
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể tải từ cấm."
    });
  }
}

async function createBadWord(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const badWord = await badWordService.createBadWord(
      req.user.id,
      req.user.role,
      req.body || {},
      req
    );
    return res.status(201).json({ ok: true, badWord });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể thêm từ cấm."
    });
  }
}

async function updateBadWord(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const badWord = await badWordService.updateBadWord(
      req.user.id,
      req.user.role,
      req.params.id,
      req.body || {},
      req
    );
    return res.json({ ok: true, badWord });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể cập nhật từ cấm."
    });
  }
}

async function deleteBadWord(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const badWord = await badWordService.deleteBadWord(
      req.user.id,
      req.user.role,
      req.params.id,
      req
    );
    return res.json({ ok: true, badWord });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể xóa từ cấm."
    });
  }
}

async function listAuditLogs(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const result = await adminService.listAuditLogs(req.user, {
      page: req.query.page,
      pageSize: req.query.pageSize,
      action: req.query.action,
      actorId: req.query.actorId
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể tải audit logs."
    });
  }
}

module.exports = {
  getStats,
  listUsers,
  updateUser,
  deactivateUser,
  listMessages,
  deleteMessage,
  editMessage,
  listBadWords,
  createBadWord,
  updateBadWord,
  deleteBadWord,
  listAuditLogs
};