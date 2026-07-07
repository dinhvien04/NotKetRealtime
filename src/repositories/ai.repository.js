const { query } = require("../db");

function mapSession(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapMessage(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    provider: row.provider || null,
    model: row.model || null,
    tokensInput: row.tokens_input ?? null,
    tokensOutput: row.tokens_output ?? null,
    createdAt: row.created_at
  };
}

async function listSessions(userId, { limit = 30 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const result = await query(
    `SELECT * FROM ai_chat_sessions
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT $2`,
    [userId, safeLimit]
  );
  return result.rows.map(mapSession);
}

async function createSession(userId, title = null) {
  const result = await query(
    `INSERT INTO ai_chat_sessions (user_id, title)
     VALUES ($1, $2)
     RETURNING *`,
    [userId, title]
  );
  return mapSession(result.rows[0]);
}

async function findSessionForUser(sessionId, userId) {
  const result = await query(
    `SELECT * FROM ai_chat_sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );
  const row = result.rows[0];
  return row ? mapSession(row) : null;
}

async function touchSession(sessionId) {
  await query(
    `UPDATE ai_chat_sessions SET updated_at = now() WHERE id = $1`,
    [sessionId]
  );
}

async function deleteSession(sessionId, userId) {
  const result = await query(
    `DELETE FROM ai_chat_sessions WHERE id = $1 AND user_id = $2 RETURNING *`,
    [sessionId, userId]
  );
  const row = result.rows[0];
  return row ? mapSession(row) : null;
}

async function listMessages(sessionId, { limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const result = await query(
    `SELECT * FROM ai_messages
     WHERE session_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [sessionId, safeLimit]
  );
  return result.rows.map(mapMessage);
}

async function addMessage({
  sessionId,
  role,
  content,
  provider = null,
  model = null,
  tokensInput = null,
  tokensOutput = null
}) {
  const result = await query(
    `INSERT INTO ai_messages (
      session_id, role, content, provider, model, tokens_input, tokens_output
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [sessionId, role, content, provider, model, tokensInput, tokensOutput]
  );
  return mapMessage(result.rows[0]);
}

async function getRecentMessages(sessionId, limit = 10) {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 20);
  const result = await query(
    `SELECT role, content FROM ai_messages
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [sessionId, safeLimit]
  );
  return result.rows.reverse();
}

module.exports = {
  listSessions,
  createSession,
  findSessionForUser,
  touchSession,
  deleteSession,
  listMessages,
  addMessage,
  getRecentMessages
};