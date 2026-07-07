const { query } = require("../db");
const { getCurrentTime } = require("../utils/time");

function mapMessageRow(row, senderName) {
  const createdAt = row.created_at;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderName: senderName || row.sender_name || "",
    receiverId: row.receiver_id || null,
    type: row.type,
    message: row.body || "",
    body: row.body || "",
    text: row.body || "",
    fileUrl: row.file_url || null,
    fileKey: row.file_key || null,
    fileName: row.file_name || null,
    mimeType: row.mime_type || null,
    size: row.file_size || null,
    createdAt,
    time: getCurrentTime(new Date(createdAt))
  };
}

async function createMessage({
  conversationId,
  senderId,
  senderName,
  receiverId,
  type,
  body,
  fileUrl,
  fileKey,
  fileName,
  mimeType,
  fileSize
}) {
  const result = await query(
    `INSERT INTO messages (
       conversation_id, sender_id, type, body,
       file_url, file_key, file_name, mime_type, file_size
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      conversationId,
      senderId,
      type,
      body || "",
      fileUrl || null,
      fileKey || null,
      fileName || null,
      mimeType || null,
      fileSize || null
    ]
  );
  return mapMessageRow(result.rows[0], senderName);
}

async function listByConversation({
  conversationId,
  limit = 30,
  cursor
}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const params = [conversationId, safeLimit];
  let cursorSql = "";

  if (cursor) {
    params.push(cursor);
    cursorSql = `AND m.created_at < (
      SELECT created_at FROM messages WHERE id = $3
    )`;
  }

  const result = await query(
    `SELECT m.*, u.username AS sender_name, u.display_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = $1
       AND m.deleted_at IS NULL
       ${cursorSql}
     ORDER BY m.created_at DESC
     LIMIT $2`,
    params
  );

  const messages = result.rows
    .reverse()
    .map((row) =>
      mapMessageRow(row, row.display_name || row.sender_name)
    );

  const nextCursor =
    result.rows.length === safeLimit ? result.rows[0]?.id || null : null;

  return { messages, nextCursor };
}

async function findById(messageId) {
  const result = await query(
    `SELECT m.*, u.username AS sender_name, u.display_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.id = $1`,
    [messageId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return mapMessageRow(row, row.display_name || row.sender_name);
}

module.exports = {
  createMessage,
  listByConversation,
  findById,
  mapMessageRow
};