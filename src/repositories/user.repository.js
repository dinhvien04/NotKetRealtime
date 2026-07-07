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

function toAdminUser(row) {
  if (!row) return null;
  return {
    ...toPublicUser(row),
    isLocked: Boolean(row.is_locked),
    lockedReason: row.locked_reason || null
  };
}

async function listForAdmin({
  q = "",
  status = "",
  role = "",
  page = 1,
  pageSize = 20
} = {}) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeSize = Math.min(Math.max(Number(pageSize) || 20, 1), 50);
  const offset = (safePage - 1) * safeSize;
  const params = [];
  const filters = [];
  let index = 1;

  if (q) {
    params.push(`%${String(q).trim().toLowerCase()}%`);
    filters.push(
      `(LOWER(username) LIKE $${index} OR LOWER(email) LIKE $${index} OR LOWER(display_name) LIKE $${index})`
    );
    index += 1;
  }

  if (status) {
    params.push(status);
    filters.push(`status = $${index++}`);
  }

  if (role) {
    params.push(role);
    filters.push(`role = $${index++}`);
  }

  const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM users ${whereSql}`,
    params
  );

  params.push(safeSize, offset);
  const result = await query(
    `SELECT ${USER_COLUMNS}
     FROM users ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${index++} OFFSET $${index}`,
    params
  );

  return {
    users: result.rows.map(toAdminUser),
    total: countResult.rows[0]?.total || 0,
    page: safePage,
    pageSize: safeSize
  };
}

async function updateAdminFields(userId, fields = {}) {
  const sets = ["updated_at = now()"];
  const params = [userId];
  let index = 2;

  if (fields.displayName !== undefined) {
    sets.push(`display_name = $${index++}`);
    params.push(fields.displayName);
  }

  if (fields.role !== undefined) {
    sets.push(`role = $${index++}`);
    params.push(fields.role);
  }

  if (fields.status !== undefined) {
    sets.push(`status = $${index++}`);
    params.push(fields.status);
  }

  if (fields.isLocked !== undefined) {
    sets.push(`is_locked = $${index++}`);
    params.push(Boolean(fields.isLocked));
  }

  if (fields.lockedReason !== undefined) {
    sets.push(`locked_reason = $${index++}`);
    params.push(fields.lockedReason || null);
  }

  const result = await query(
    `UPDATE users SET ${sets.join(", ")} WHERE id = $1 RETURNING ${USER_COLUMNS}`,
    params
  );
  return toAdminUser(result.rows[0]);
}

async function setRole(userId, role) {
  const result = await query(
    `UPDATE users SET role = $2, updated_at = now() WHERE id = $1 RETURNING ${USER_COLUMNS}`,
    [userId, role]
  );
  return toAdminUser(result.rows[0]);
}

async function searchUsers(queryText, { excludeUserId, limit = 20 } = {}) {
  const q = String(queryText || "").trim().toLowerCase();
  if (!q || q.length < 2) {
    return [];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const params = [`%${q}%`, safeLimit];
  let excludeSql = "";
  if (excludeUserId) {
    params.push(excludeUserId);
    excludeSql = `AND id <> $3`;
  }

  const result = await query(
    `SELECT id, username, display_name, avatar_url, role, status, is_locked
     FROM users
     WHERE status = 'active' AND is_locked = false
       AND (LOWER(username) LIKE $1 OR LOWER(display_name) LIKE $1)
       ${excludeSql}
     ORDER BY username ASC
     LIMIT $2`,
    params
  );

  return result.rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    avatarUrl: row.avatar_url || null,
    role: row.role || "user"
  }));
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
  toPublicUser,
  toAdminUser,
  listForAdmin,
  updateAdminFields,
  setRole,
  searchUsers
};