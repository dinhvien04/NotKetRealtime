const { query } = require("../db");

function mapRow(row) {
  if (!row) return null;
  return {
    fileKey: row.file_key,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    kind: row.kind,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    consumedAt: row.consumed_at
  };
}

async function createPendingUpload({
  fileKey,
  fileName,
  mimeType,
  fileSize,
  kind,
  expiresAt
}) {
  try {
    const result = await query(
      `INSERT INTO document_uploads (
         file_key, file_name, mime_type, file_size, kind, status, expires_at
       ) VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       RETURNING *`,
      [fileKey, fileName, mimeType, fileSize, kind, expiresAt]
    );
    return mapRow(result.rows[0]);
  } catch (error) {
    if (error && error.code === "23505") {
      const conflict = new Error("fileKey đã tồn tại (pending upload collision).");
      conflict.status = 409;
      throw conflict;
    }
    throw error;
  }
}

async function findPendingUpload(fileKey) {
  const result = await query(
    `SELECT * FROM document_uploads WHERE file_key = $1`,
    [fileKey]
  );
  return mapRow(result.rows[0]);
}

async function consumePendingUpload(fileKey) {
  const result = await query(
    `UPDATE document_uploads
     SET status = 'consumed', consumed_at = now()
     WHERE file_key = $1
       AND status = 'pending'
       AND expires_at > now()
     RETURNING *`,
    [fileKey]
  );
  return mapRow(result.rows[0]);
}

async function expireOldUploads() {
  const result = await query(
    `UPDATE document_uploads
     SET status = 'expired'
     WHERE status = 'pending' AND expires_at <= now()`
  );
  return result.rowCount || 0;
}

/**
 * Sum file_size of pending uploads that are not yet expired.
 * Used for storage quota so reserved pending space cannot be double-spent.
 */
async function getPendingUploadBytes() {
  const result = await query(
    `SELECT COALESCE(SUM(file_size), 0)::bigint AS pending_bytes
     FROM document_uploads
     WHERE status = 'pending'
       AND expires_at > now()`
  );
  return Number(result.rows[0]?.pending_bytes || 0);
}

module.exports = {
  createPendingUpload,
  findPendingUpload,
  consumePendingUpload,
  expireOldUploads,
  getPendingUploadBytes
};
