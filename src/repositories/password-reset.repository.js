const { query } = require("../db");

async function createToken({
  userId,
  email,
  otpHash,
  expiresAt,
  requestIp
}) {
  const result = await query(
    `INSERT INTO password_reset_tokens (
       user_id, email, otp_hash, expires_at, request_ip
     ) VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, email, expires_at, created_at`,
    [userId, email, otpHash, expiresAt, requestIp || null]
  );
  return result.rows[0];
}

async function findActiveByEmail(email) {
  const result = await query(
    `SELECT id, user_id, email, otp_hash, expires_at, used_at, verified_at,
            verify_attempts, created_at
     FROM password_reset_tokens
     WHERE LOWER(email) = LOWER($1)
       AND used_at IS NULL
       AND expires_at > now()
     ORDER BY created_at DESC
     LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

async function findById(tokenId) {
  const result = await query(
    `SELECT id, user_id, email, otp_hash, expires_at, used_at, verified_at,
            verify_attempts, created_at
     FROM password_reset_tokens
     WHERE id = $1`,
    [tokenId]
  );
  return result.rows[0] || null;
}

async function incrementVerifyAttempts(tokenId) {
  await query(
    `UPDATE password_reset_tokens
     SET verify_attempts = verify_attempts + 1
     WHERE id = $1`,
    [tokenId]
  );
}

async function markVerified(tokenId) {
  await query(
    `UPDATE password_reset_tokens
     SET verified_at = now()
     WHERE id = $1`,
    [tokenId]
  );
}

async function markUsed(tokenId) {
  await query(
    `UPDATE password_reset_tokens
     SET used_at = now()
     WHERE id = $1`,
    [tokenId]
  );
}

async function invalidateActiveForEmail(email) {
  await query(
    `UPDATE password_reset_tokens
     SET used_at = now()
     WHERE LOWER(email) = LOWER($1)
       AND used_at IS NULL`,
    [email]
  );
}

module.exports = {
  createToken,
  findActiveByEmail,
  findById,
  incrementVerifyAttempts,
  markVerified,
  markUsed,
  invalidateActiveForEmail
};