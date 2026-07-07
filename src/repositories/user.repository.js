const { query } = require("../db");

function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email || null,
    displayName: row.display_name || row.username,
    avatarUrl: row.avatar_url || null,
    createdAt: row.created_at
  };
}

async function createUser({ username, email, passwordHash, displayName }) {
  const result = await query(
    `INSERT INTO users (username, email, password_hash, display_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, email, display_name, avatar_url, created_at`,
    [username, email || null, passwordHash, displayName || username]
  );
  return toPublicUser(result.rows[0]);
}

async function findById(userId) {
  const result = await query(
    `SELECT id, username, email, password_hash, display_name, avatar_url, created_at
     FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function findByUsername(username) {
  const result = await query(
    `SELECT id, username, email, password_hash, display_name, avatar_url, created_at
     FROM users WHERE LOWER(username) = LOWER($1)`,
    [username]
  );
  return result.rows[0] || null;
}

async function findByEmail(email) {
  const result = await query(
    `SELECT id, username, email, password_hash, display_name, avatar_url, created_at
     FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  return result.rows[0] || null;
}

async function findByUsernameOrEmail(identifier) {
  const result = await query(
    `SELECT id, username, email, password_hash, display_name, avatar_url, created_at
     FROM users
     WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
     LIMIT 1`,
    [identifier]
  );
  return result.rows[0] || null;
}

async function listByIds(userIds) {
  if (!userIds.length) return [];
  const result = await query(
    `SELECT id, username, email, display_name, avatar_url, created_at
     FROM users WHERE id = ANY($1::uuid[])`,
    [userIds]
  );
  return result.rows.map(toPublicUser);
}

module.exports = {
  createUser,
  findById,
  findByUsername,
  findByEmail,
  findByUsernameOrEmail,
  listByIds,
  toPublicUser
};