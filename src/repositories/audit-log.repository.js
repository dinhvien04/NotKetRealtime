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

module.exports = {
  create
};