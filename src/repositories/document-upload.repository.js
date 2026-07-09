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
  const result = await query(
    `INSERT INTO document_uploads (
       file_key, file_name, mime_type, file_size, kind, status, expires_at
     ) VALUES ($1, $2, $3, $4, $5, 'pending', $6)
     ON CONFLICT (file_key) DO UPDATE SET
       file_name = EXCLUDED.file_name,
       mime_type = EXCLUDED.mime_type,
       file_size = EXCLUDED.file_size,
       kind = EXCLUDED.kind,
       status = 'pending',
       expires_at = EXCLUDED.expires_at,
       consumed_at = NULL
     RETURNING *`,
    [fileKey, fileName, mimeType, fileSize, kind, expiresAt]
  );
  return mapRow(result.rows[0]);
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

module.exports = {
  createPendingUpload,
  findPendingUpload,
  consumePendingUpload,
  expireOldUploads
};
