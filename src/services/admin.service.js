const userRepository = require("../repositories/user.repository");
const messageRepository = require("../repositories/message.repository");
const auditLogRepository = require("../repositories/audit-log.repository");
const messageService = require("./message.service");
const auditService = require("./audit.service");
const { sanitizeDisplayName } = require("../utils/sanitize");

const STAFF_ROLES = new Set(["admin", "moderator"]);
const USER_ROLES = new Set(["user", "moderator", "admin"]);

function assertStaff(actor) {
  if (!STAFF_ROLES.has(actor?.role)) {
    throw new Error("Bạn không có quyền thực hiện thao tác này.");
  }
}

function assertAdmin(actor) {
  if (actor?.role !== "admin") {
    throw new Error("Chỉ admin mới có quyền thực hiện thao tác này.");
  }
}

function assertNotSelf(actorId, targetId, message) {
  if (actorId === targetId) {
    throw new Error(message);
  }
}

async function getStats(actor) {
  assertStaff(actor);
  return messageRepository.getAdminStats();
}

async function listUsers(actor, options = {}) {
  assertStaff(actor);
  return userRepository.listForAdmin(options);
}

async function updateUser(actor, targetUserId, updates = {}, req = null) {
  assertStaff(actor);

  const target = await userRepository.findById(targetUserId);
  if (!target) {
    throw new Error("Người dùng không tồn tại.");
  }

  const fields = {};

  if (updates.displayName !== undefined) {
    fields.displayName = sanitizeDisplayName(updates.displayName);
    if (!fields.displayName) {
      throw new Error("Tên hiển thị không hợp lệ.");
    }
  }

  if (updates.isLocked !== undefined) {
    assertNotSelf(actor.id, targetUserId, "Bạn không thể khóa chính mình.");
    fields.isLocked = Boolean(updates.isLocked);
    fields.lockedReason = fields.isLocked
      ? String(updates.lockedReason || "Bị khóa bởi quản trị viên.").slice(0, 280)
      : null;
  }

  if (updates.role !== undefined) {
    assertAdmin(actor);
    assertNotSelf(actor.id, targetUserId, "Bạn không thể đổi role của chính mình.");
    if (!USER_ROLES.has(updates.role)) {
      throw new Error("Role không hợp lệ.");
    }
    fields.role = updates.role;
  }

  if (updates.status !== undefined) {
    assertAdmin(actor);
    assertNotSelf(actor.id, targetUserId, "Bạn không thể vô hiệu hóa chính mình.");
    if (!["active", "inactive"].includes(updates.status)) {
      throw new Error("Trạng thái không hợp lệ.");
    }
    fields.status = updates.status;
  }

  if (!Object.keys(fields).length) {
    return userRepository.toAdminUser(target);
  }

  const updated = await userRepository.updateAdminFields(targetUserId, fields);

  if (fields.isLocked !== undefined) {
    await auditService.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: fields.isLocked ? "admin.user.lock" : "admin.user.unlock",
      targetType: "user",
      targetId: targetUserId,
      details: { lockedReason: fields.lockedReason || null },
      req
    });
  }

  if (fields.role !== undefined) {
    await auditService.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: "admin.user.role_change",
      targetType: "user",
      targetId: targetUserId,
      details: { role: fields.role },
      req
    });
  }

  if (fields.status !== undefined) {
    await auditService.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: "admin.user.deactivate",
      targetType: "user",
      targetId: targetUserId,
      details: { status: fields.status },
      req
    });
  }

  return updated;
}

async function deactivateUser(actor, targetUserId, req = null) {
  assertAdmin(actor);
  assertNotSelf(actor.id, targetUserId, "Bạn không thể vô hiệu hóa chính mình.");
  return updateUser(
    actor,
    targetUserId,
    { status: "inactive", isLocked: true, lockedReason: "Tài khoản đã bị vô hiệu hóa." },
    req
  );
}

async function listMessages(actor, options = {}) {
  assertStaff(actor);
  return messageRepository.listForAdmin(options);
}

async function deleteMessage(actor, messageId, req = null) {
  assertStaff(actor);
  return messageService.deleteMessage(actor.id, messageId, req);
}

async function editMessage(actor, messageId, body, req = null) {
  assertStaff(actor);
  return messageService.editMessage(actor.id, messageId, body, req);
}

async function listAuditLogs(actor, options = {}) {
  assertStaff(actor);
  return auditLogRepository.list(options);
}

module.exports = {
  getStats,
  listUsers,
  updateUser,
  deactivateUser,
  listMessages,
  deleteMessage,
  editMessage,
  listAuditLogs
};