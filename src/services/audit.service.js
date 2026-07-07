const auditLogRepository = require("../repositories/audit-log.repository");
const { getClientIp, getUserAgent } = require("../utils/request-meta");

async function log({
  actorId = null,
  actorRole = null,
  action,
  targetType = null,
  targetId = null,
  details = null,
  req = null
}) {
  if (!action) return;

  await auditLogRepository.create({
    actorId,
    actorRole,
    action,
    targetType,
    targetId,
    details,
    ip: req ? getClientIp(req) : null,
    userAgent: req ? getUserAgent(req) : null
  });
}

module.exports = {
  log
};