const { query } = require("../db");

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    body: row.body,
    fileKey: row.file_key,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
    deletedAt: row.deleted_at
  };
}

async function createTextMessage({ body }) {
  const result = await query(
    `INSERT INTO document_messages (type, body)
     VALUES ('text', $1)
     RETURNING *`,
    [body]
  );
  return mapRow(result.rows[0]);
}

async function createFileMessage({ type, body, fileKey, fileName, mimeType, fileSize }) {
  const result = await query(
    `INSERT INTO document_messages (type, body, file_key, file_name, mime_type, file_size)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [type, body || null, fileKey, fileName, mimeType, fileSize]
  );
  return mapRow(result.rows[0]);
}

async function listMessages({ cursor = null, limit = DEFAULT_LIMIT, q = "", type = "all" } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const params = [];
  const conditions = ["deleted_at IS NULL"];

  if (type && type !== "all") {
    params.push(type);
    conditions.push(`type = $${params.length}`);
  }

  if (q && String(q).trim()) {
    params.push(`%${String(q).trim()}%`);
    conditions.push(`(body ILIKE $${params.length} OR file_name ILIKE $${params.length})`);
  }

  if (cursor) {
    // cursor format: ISO|id
    const [createdAt, id] = String(cursor).split("|");
    if (createdAt && id) {
      params.push(createdAt, id);
      conditions.push(
        `(created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`
      );
    }
  }

  params.push(safeLimit + 1);
  const sql = `
    SELECT *
    FROM document_messages
    WHERE ${conditions.join(" AND ")}
    ORDER BY created_at DESC, id DESC
    LIMIT $${params.length}
  `;

  const result = await query(sql, params);
  const rows = result.rows.map(mapRow);
  const hasMore = rows.length > safeLimit;
  const messages = hasMore ? rows.slice(0, safeLimit) : rows;
  let nextCursor = null;
  if (hasMore && messages.length) {
    const last = messages[messages.length - 1];
    nextCursor = `${new Date(last.createdAt).toISOString()}|${last.id}`;
  }

  return { messages, nextCursor, hasMore };
}

async function findById(id) {
  const result = await query(
    `SELECT * FROM document_messages WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return mapRow(result.rows[0]);
}

async function findByFileKey(fileKey) {
  const result = await query(
    `SELECT * FROM document_messages
     WHERE file_key = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [fileKey]
  );
  return mapRow(result.rows[0]);
}

async function softDelete(id) {
  const result = await query(
    `UPDATE document_messages
     SET deleted_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING *`,
    [id]
  );
  return mapRow(result.rows[0]);
}

async function getStorageUsage() {
  const result = await query(
    `SELECT COALESCE(SUM(file_size), 0)::bigint AS used_bytes
     FROM document_messages
     WHERE deleted_at IS NULL
       AND type IN ('image', 'file')
       AND file_size IS NOT NULL`
  );
  return Number(result.rows[0]?.used_bytes || 0);
}

async function listRecentByType(type, limit = 12) {
  const result = await query(
    `SELECT *
     FROM document_messages
     WHERE deleted_at IS NULL AND type = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [type, limit]
  );
  return result.rows.map(mapRow);
}

/**
 * Recent text messages that likely contain URLs (for info panel Links section).
 * Broad SQL filter; exact URL parse happens in service layer.
 */
async function listRecentTextWithLinks(limit = 100) {
  const result = await query(
    `SELECT *
     FROM document_messages
     WHERE deleted_at IS NULL
       AND type = 'text'
       AND body IS NOT NULL
       AND (
         body ILIKE '%http://%'
         OR body ILIKE '%https://%'
         OR body ILIKE '%www.%'
       )
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows.map(mapRow);
}

module.exports = {
  createTextMessage,
  createFileMessage,
  listMessages,
  findById,
  findByFileKey,
  softDelete,
  getStorageUsage,
  listRecentByType,
  listRecentTextWithLinks,
  DEFAULT_LIMIT,
  MAX_LIMIT
};
