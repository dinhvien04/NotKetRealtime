const { query } = require("../db");

async function createPending({
  uploaderId,
  bucket,
  fileKey,
  fileUrl = null,
  fileName,
  mimeType,
  fileSize,
  kind,
  durationMs = null,
  metadata = {}
}) {
  const result = await query(
    `INSERT INTO attachments (
       uploader_id, storage_provider, bucket, file_key, file_url,
       file_name, mime_type, file_size, kind, duration_ms, metadata
     ) VALUES ($1, 's3', $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      uploaderId,
      bucket,
      fileKey,
      fileUrl,
      fileName,
      mimeType,
      fileSize,
      kind,
      durationMs,
      JSON.stringify(metadata || {})
    ]
  );
  return result.rows[0];
}

async function linkToMessage(fileKey, messageId) {
  const result = await query(
    `UPDATE attachments
     SET message_id = $2
     WHERE file_key = $1 AND message_id IS NULL
     RETURNING *`,
    [fileKey, messageId]
  );
  return result.rows[0] || null;
}

async function findByFileKey(fileKey) {
  const result = await query(`SELECT * FROM attachments WHERE file_key = $1 LIMIT 1`, [
    fileKey
  ]);
  return result.rows[0] || null;
}

async function userCanAccessFileKey(fileKey, userId) {
  const result = await query(
    `SELECT 1
     FROM attachments a
     LEFT JOIN messages m ON m.id = a.message_id
     LEFT JOIN conversation_participants cp
       ON cp.conversation_id = m.conversation_id
      AND cp.user_id = $2
      AND cp.left_at IS NULL
     WHERE a.file_key = $1
       AND (
         a.uploader_id = $2
         OR cp.user_id IS NOT NULL
       )
     LIMIT 1`,
    [fileKey, userId]
  );
  return result.rowCount > 0;
}

module.exports = {
  createPending,
  linkToMessage,
  findByFileKey,
  userCanAccessFileKey
};