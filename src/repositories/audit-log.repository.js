const { query } = require("../db");

async function create({
  actorId,
  actorRole,
  action,
  targetType,
  targetId,
  details,
  ip,
  userAgent
}) {
  await query(
    `INSERT INTO audit_logs (
       actor_id, actor_role, action, target_type, target_id, details, ip, user_agent
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      actorId || null,
      actorRole || null,
      action,
      targetType || null,
      targetId || null,
      details ? JSON.stringify(details) : null,
      ip || null,
      userAgent || null
    ]
  );
}

function mapRow(row) {
  return {
    id: row.id,
    actorId: row.actor_id || null,
    actorRole: row.actor_role || null,
    action: row.action,
    targetType: row.target_type || null,
    targetId: row.target_id || null,
    details: row.details || null,
    ip: row.ip || null,
    userAgent: row.user_agent || null,
    createdAt: row.created_at
  };
}

async function list({ page = 1, pageSize = 30, action = null, actorId = null } = {}) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeSize = Math.min(Math.max(Number(pageSize) || 30, 1), 100);
  const offset = (safePage - 1) * safeSize;
  const params = [];
  const filters = [];
  let index = 1;

  if (action) {
    filters.push(`action = $${index++}`);
    params.push(action);
  }

  if (actorId) {
    filters.push(`actor_id = $${index++}`);
    params.push(actorId);
  }

  const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM audit_logs ${whereSql}`,
    params
  );

  params.push(safeSize, offset);
  const result = await query(
    `SELECT * FROM audit_logs ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${index++} OFFSET $${index}`,
    params
  );

  return {
    items: result.rows.map(mapRow),
    total: countResult.rows[0]?.total || 0,
    page: safePage,
    pageSize: safeSize
  };
}

module.exports = {
  create,
  list
};