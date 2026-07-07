const { query } = require("../db");

const USER_COLUMNS = `
  id, username, email, password_hash, display_name, avatar_url, bio,
  role, status, is_locked, locked_reason, last_seen_at, password_changed_at,
  created_at, updated_at
`;

function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email || null,
    displayName: row.display_name || row.username,
    avatarUrl: row.avatar_url || null,
    bio: row.bio || "",
    role: row.role || "user",
    status: row.status || "active",
    lastSeenAt: row.last_seen_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function createUser({ username, email, passwordHash, displayName }) {
  const result = await query(
    `INSERT INTO users (username, email, password_hash, display_name)
     VALUES ($1, $2, $3, $4)
     RETURNING ${USER_COLUMNS}`,
    [username, email || null, passwordHash, displayName || username]
  );
  return toPublicUser(result.rows[0]);
}

async function findById(userId) {
  const result = await query(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function findByUsername(username) {
  const result = await query(
    `SELECT ${USER_COLUMNS} FROM users WHERE LOWER(username) = LOWER($1)`,
    [username]
  );
  return result.rows[0] || null;
}

async function findByEmail(email) {
  const result = await query(
    `SELECT ${USER_COLUMNS} FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  return result.rows[0] || null;
}

async function findByUsernameOrEmail(identifier) {
  const result = await query(
    `SELECT ${USER_COLUMNS}
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
    `SELECT id, username, email, display_name, avatar_url, bio, role, status,
            last_seen_at, created_at, updated_at
     FROM users WHERE id = ANY($1::uuid[])`,
    [userIds]
  );
  return result.rows.map(toPublicUser);
}

async function updateLastSeen(userId) {
  await query(
    `UPDATE users SET last_seen_at = now(), updated_at = now() WHERE id = $1`,
    [userId]
  );
}

async function updateProfile(userId, fields = {}) {
  const sets = ["updated_at = now()"];
  const params = [userId];
  let index = 2;

  if (fields.displayName !== undefined) {
    sets.push(`display_name = $${index++}`);
    params.push(fields.displayName);
  }
  if (fields.bio !== undefined) {
    sets.push(`bio = $${index++}`);
    params.push(fields.bio);
  }
  if (fields.email !== undefined) {
    sets.push(`email = $${index++}`);
    params.push(fields.email);
  }
  if (fields.avatarUrl !== undefined) {
    sets.push(`avatar_url = $${index++}`);
    params.push(fields.avatarUrl);
  }

  const result = await query(
    `UPDATE users SET ${sets.join(", ")} WHERE id = $1 RETURNING ${USER_COLUMNS}`,
    params
  );
  return toPublicUser(result.rows[0]);
}

async function updatePassword(userId, passwordHash) {
  await query(
    `UPDATE users
     SET password_hash = $2,
         password_changed_at = now(),
         updated_at = now()
     WHERE id = $1`,
    [userId, passwordHash]
  );
}

module.exports = {
  createUser,
  findById,
  findByUsername,
  findByEmail,
  findByUsernameOrEmail,
  listByIds,
  updateLastSeen,
  updateProfile,
  updatePassword,
  toPublicUser
};