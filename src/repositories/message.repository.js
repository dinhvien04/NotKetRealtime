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
    wasFiltered: Boolean(row.was_filtered),
    filterHits: row.filter_hits || [],
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
  replyToMessageId,
  wasFiltered = false,
  filterHits = []
}) {
  const result = await query(
    `INSERT INTO messages (
       conversation_id, sender_id, type, body,
       file_url, file_key, file_name, mime_type, file_size,
       duration_ms, reply_to_message_id, was_filtered, filter_hits
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
      replyToMessageId || null,
      Boolean(wasFiltered),
      filterHits?.length ? filterHits : null
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

async function listForAdmin({
  q = "",
  conversationId = null,
  userId = null,
  type = null,
  page = 1,
  pageSize = 30
} = {}) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeSize = Math.min(Math.max(Number(pageSize) || 30, 1), 50);
  const offset = (safePage - 1) * safeSize;
  const params = [];
  const filters = ["m.deleted_at IS NULL"];
  let index = 1;

  if (q) {
    params.push(q.trim());
    filters.push(
      `to_tsvector('simple', coalesce(m.body, '') || ' ' || coalesce(m.file_name, ''))
       @@ plainto_tsquery('simple', $${index++})`
    );
  }

  if (conversationId) {
    params.push(conversationId);
    filters.push(`m.conversation_id = $${index++}`);
  }

  if (userId) {
    params.push(userId);
    filters.push(`m.sender_id = $${index++}`);
  }

  if (type) {
    params.push(type);
    filters.push(`m.type = $${index++}`);
  }

  const whereSql = `WHERE ${filters.join(" AND ")}`;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM messages m ${whereSql}`,
    params
  );

  params.push(safeSize, offset);
  const result = await query(
    `SELECT m.*, u.username AS sender_name, u.display_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     ${whereSql}
     ORDER BY m.created_at DESC
     LIMIT $${index++} OFFSET $${index}`,
    params
  );

  const messages = result.rows.map((row) =>
    mapMessageRow(row, row.display_name || row.sender_name)
  );

  return {
    messages,
    total: countResult.rows[0]?.total || 0,
    page: safePage,
    pageSize: safeSize
  };
}

async function getAdminStats() {
  const result = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM users) AS total_users,
       (SELECT COUNT(*)::int FROM users WHERE status = 'active' AND is_locked = false) AS active_users,
       (SELECT COUNT(*)::int FROM users WHERE is_locked = true) AS locked_users,
       (SELECT COUNT(*)::int FROM messages WHERE deleted_at IS NULL) AS total_messages,
       (SELECT COUNT(*)::int FROM messages
         WHERE deleted_at IS NULL AND created_at >= date_trunc('day', now())) AS messages_today,
       (SELECT COUNT(*)::int FROM messages
         WHERE deleted_at IS NULL AND file_key IS NOT NULL) AS files_uploaded,
       (SELECT COALESCE(SUM(file_size), 0)::bigint FROM messages
         WHERE deleted_at IS NULL AND file_size IS NOT NULL) AS storage_used_bytes,
       (SELECT COUNT(*)::int FROM conversations WHERE type = 'direct') AS direct_conversations,
       (SELECT COUNT(*)::int FROM conversations WHERE type = 'group') AS group_conversations,
       (SELECT COUNT(*)::int FROM conversations WHERE type = 'public') AS public_conversations`
  );
  const row = result.rows[0] || {};
  return {
    totalUsers: row.total_users || 0,
    activeUsers: row.active_users || 0,
    lockedUsers: row.locked_users || 0,
    totalMessages: row.total_messages || 0,
    messagesToday: row.messages_today || 0,
    filesUploaded: row.files_uploaded || 0,
    storageUsedBytes: Number(row.storage_used_bytes || 0),
    conversations: {
      direct: row.direct_conversations || 0,
      group: row.group_conversations || 0,
      public: row.public_conversations || 0
    }
  };
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
  attachReactions,
  listForAdmin,
  getAdminStats
};