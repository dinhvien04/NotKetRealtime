const { query } = require("../db");
const { getCurrentTime } = require("../utils/time");
const reactionRepository = require("./reaction.repository");
const { resolveFileUrl } = require("../services/storage.service");

function mapMessageRow(row, senderName, reactions = []) {
  const createdAt = row.created_at;
  const isDeleted = Boolean(row.deleted_at);
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderName: senderName || row.sender_name || "",
    receiverId: row.receiver_id || null,
    type: row.type,
    message: isDeleted ? "" : row.body || "",
    body: isDeleted ? "" : row.body || "",
    text: isDeleted ? "" : row.body || "",
    fileUrl: isDeleted ? null : row.file_url || null,
    fileKey: isDeleted ? null : row.file_key || null,
    fileName: isDeleted ? null : row.file_name || null,
    mimeType: isDeleted ? null : row.mime_type || null,
    size: isDeleted ? null : row.file_size || null,
    durationMs: isDeleted ? null : row.duration_ms || null,
    replyToMessageId: row.reply_to_message_id || null,
    isEdited: Boolean(row.is_edited),
    editedAt: row.edited_at || null,
    isDeleted,
    deletedAt: row.deleted_at || null,
    deletedBy: row.deleted_by || null,
    reactions,
    createdAt,
    time: getCurrentTime(new Date(createdAt))
  };
}

async function attachReactions(messages) {
  const ids = messages.map((message) => message.id);
  const grouped = await reactionRepository.listByMessageIds(ids);
  return messages.map((message) => ({
    ...message,
    reactions: grouped.get(message.id) || []
  }));
}

async function enrichFileUrls(messages) {
  const enriched = [];
  for (const message of messages) {
    if (!message.isDeleted && message.fileKey) {
      try {
        const fileUrl = await resolveFileUrl(message.fileKey);
        enriched.push({ ...message, fileUrl });
      } catch (_error) {
        enriched.push(message);
      }
    } else {
      enriched.push(message);
    }
  }
  return enriched;
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
  fileSize,
  durationMs,
  replyToMessageId
}) {
  const result = await query(
    `INSERT INTO messages (
       conversation_id, sender_id, type, body,
       file_url, file_key, file_name, mime_type, file_size,
       duration_ms, reply_to_message_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
      fileSize || null,
      durationMs || null,
      replyToMessageId || null
    ]
  );
  const message = mapMessageRow(result.rows[0], senderName);
  const [withUrl] = await enrichFileUrls([message]);
  return withUrl;
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

  const withReactions = await attachReactions(messages);
  const withUrls = await enrichFileUrls(withReactions);
  const nextCursor =
    result.rows.length === safeLimit ? result.rows[0]?.id || null : null;

  return {
    messages: withUrls,
    nextCursor,
    hasMore: Boolean(nextCursor)
  };
}

async function findById(messageId, { includeDeleted = true } = {}) {
  const deletedSql = includeDeleted ? "" : "AND m.deleted_at IS NULL";
  const result = await query(
    `SELECT m.*, u.username AS sender_name, u.display_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.id = $1 ${deletedSql}`,
    [messageId]
  );
  const row = result.rows[0];
  if (!row) return null;
  const message = mapMessageRow(row, row.display_name || row.sender_name);
  const reactions = await reactionRepository.listByMessageIds([messageId]);
  message.reactions = reactions.get(messageId) || [];
  const [withUrl] = await enrichFileUrls([message]);
  return withUrl;
}

async function findRawById(messageId) {
  const result = await query(`SELECT * FROM messages WHERE id = $1`, [messageId]);
  return result.rows[0] || null;
}

async function editMessage(messageId, body) {
  const result = await query(
    `UPDATE messages
     SET body = $2, is_edited = true, edited_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING *`,
    [messageId, body]
  );
  const row = result.rows[0];
  if (!row) return null;
  return findById(row.id);
}

async function softDeleteMessage(messageId, deletedBy) {
  const result = await query(
    `UPDATE messages
     SET deleted_at = now(), deleted_by = $2
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING *`,
    [messageId, deletedBy]
  );
  const row = result.rows[0];
  if (!row) return null;
  return findById(row.id);
}

async function searchInConversation({
  conversationId,
  queryText,
  type,
  fromDate,
  toDate,
  limit = 20,
  cursor
}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const params = [conversationId];
  const filters = ["m.conversation_id = $1", "m.deleted_at IS NULL"];
  let index = 2;

  if (queryText) {
    params.push(queryText.trim());
    filters.push(
      `to_tsvector('simple', coalesce(m.body, '') || ' ' || coalesce(m.file_name, ''))
       @@ plainto_tsquery('simple', $${index++})`
    );
  }

  if (type) {
    params.push(type);
    filters.push(`m.type = $${index++}`);
  }

  if (fromDate) {
    params.push(fromDate);
    filters.push(`m.created_at >= $${index++}`);
  }

  if (toDate) {
    params.push(toDate);
    filters.push(`m.created_at <= $${index++}`);
  }

  if (cursor) {
    params.push(cursor);
    filters.push(`m.created_at < (SELECT created_at FROM messages WHERE id = $${index++})`);
  }

  params.push(safeLimit);
  const limitParam = `$${index}`;

  const result = await query(
    `SELECT m.*, u.username AS sender_name, u.display_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE ${filters.join(" AND ")}
     ORDER BY m.created_at DESC
     LIMIT ${limitParam}`,
    params
  );

  const messages = result.rows.map((row) =>
    mapMessageRow(row, row.display_name || row.sender_name)
  );
  const withReactions = await attachReactions(messages);
  const withUrls = await enrichFileUrls(withReactions);
  const nextCursor =
    result.rows.length === safeLimit ? result.rows[0]?.id || null : null;

  return {
    messages: withUrls,
    nextCursor,
    hasMore: Boolean(nextCursor)
  };
}

async function countUnread(conversationId, userId, lastReadMessageId) {
  const params = [conversationId, userId];
  let readSql = "";

  if (lastReadMessageId) {
    params.push(lastReadMessageId);
    readSql = `AND m.created_at > (
      SELECT created_at FROM messages WHERE id = $3
    )`;
  }

  const result = await query(
    `SELECT COUNT(*)::int AS unread_count
     FROM messages m
     WHERE m.conversation_id = $1
       AND m.deleted_at IS NULL
       AND m.sender_id <> $2
       ${readSql}`,
    params
  );

  return result.rows[0]?.unread_count || 0;
}

module.exports = {
  createMessage,
  listByConversation,
  findById,
  findRawById,
  editMessage,
  softDeleteMessage,
  searchInConversation,
  countUnread,
  mapMessageRow,
  attachReactions
};