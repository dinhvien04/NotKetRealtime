const aiService = require("../services/ai.service");
const { getDatabaseError } = require("../db");

async function listSessions(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const sessions = await aiService.listSessions(req.user.id);
    return res.json({ ok: true, sessions });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể tải phiên AI."
    });
  }
}

async function createSession(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const session = await aiService.createSession(req.user.id, req.body?.title);
    return res.status(201).json({ ok: true, session });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể tạo phiên AI."
    });
  }
}

async function getSessionMessages(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const result = await aiService.getSessionMessages(
      req.user.id,
      req.params.id
    );
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể tải tin nhắn AI."
    });
  }
}

async function sendMessage(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const result = await aiService.sendMessage(
      req.user.id,
      req.params.id,
      req.body?.content ?? req.body?.message ?? req.body?.text,
      req
    );
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể gửi tin nhắn AI."
    });
  }
}

async function deleteSession(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const session = await aiService.deleteSession(
      req.user.id,
      req.params.id,
      req
    );
    return res.json({ ok: true, session });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể xóa phiên AI."
    });
  }
}

module.exports = {
  listSessions,
  createSession,
  getSessionMessages,
  sendMessage,
  deleteSession
};