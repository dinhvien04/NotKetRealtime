const conversationRepository = require("../repositories/conversation.repository");
const userRepository = require("../repositories/user.repository");
const auditService = require("./audit.service");
const iconService = require("./icon.service");

async function createGroup(ownerId, { name, memberIds = [], iconName, iconColor }, req = null) {
  const owner = await userRepository.findById(ownerId);
  if (!owner) {
    throw new Error("Người dùng không tồn tại.");
  }

  const validMemberIds = [];
  for (const memberId of memberIds) {
    if (!memberId || memberId === ownerId) continue;
    const member = await userRepository.findById(memberId);
    if (member) {
      validMemberIds.push(memberId);
    }
  }

  const iconSelection = iconName
    ? iconService.validateIconSelection({ iconName, color: iconColor })
    : { iconName: null, iconColor: null };

  const group = await conversationRepository.createGroup({
    name,
    ownerId,
    memberIds: validMemberIds,
    iconName: iconSelection.iconName,
    iconColor: iconSelection.iconColor
  });

  if (iconSelection.iconName) {
    await iconService.rememberIcon(ownerId, iconSelection.iconName, iconSelection.iconColor);
  }

  await auditService.log({
    actorId: ownerId,
    actorRole: owner.role,
    action: "group.create",
    targetType: "conversation",
    targetId: group.id,
    details: { name: group.name, memberCount: validMemberIds.length + 1 },
    req
  });

  return group;
}

async function updateGroup(conversationId, actorId, updates, req = null) {
  const normalizedUpdates = { ...updates };
  if (updates.iconName !== undefined) {
    if (updates.iconName) {
      const iconSelection = iconService.validateIconSelection({
        iconName: updates.iconName,
        color: updates.iconColor
      });
      normalizedUpdates.iconName = iconSelection.iconName;
      normalizedUpdates.iconColor = iconSelection.iconColor;
      await iconService.rememberIcon(actorId, iconSelection.iconName, iconSelection.iconColor);
    } else {
      normalizedUpdates.iconName = null;
      normalizedUpdates.iconColor = null;
    }
  }

  const group = await conversationRepository.updateGroup(
    conversationId,
    actorId,
    normalizedUpdates
  );

  const actor = await userRepository.findById(actorId);
  await auditService.log({
    actorId,
    actorRole: actor?.role || "user",
    action: "group.update",
    targetType: "conversation",
    targetId: conversationId,
    details: { fields: Object.keys(normalizedUpdates) },
    req
  });

  return group;
}

async function addParticipant(conversationId, actorId, targetUserId, req = null) {
  const target = await userRepository.findById(targetUserId);
  if (!target) {
    throw new Error("Người dùng không tồn tại.");
  }

  const participants = await conversationRepository.addGroupParticipant(
    conversationId,
    actorId,
    targetUserId
  );

  const actor = await userRepository.findById(actorId);
  await auditService.log({
    actorId,
    actorRole: actor?.role || "user",
    action: "group.add_member",
    targetType: "conversation",
    targetId: conversationId,
    details: { userId: targetUserId },
    req
  });

  return participants;
}

async function removeParticipant(
  conversationId,
  actorId,
  targetUserId,
  req = null
) {
  const participants = await conversationRepository.removeGroupParticipant(
    conversationId,
    actorId,
    targetUserId
  );

  const actor = await userRepository.findById(actorId);
  await auditService.log({
    actorId,
    actorRole: actor?.role || "user",
    action: actorId === targetUserId ? "group.leave" : "group.remove_member",
    targetType: "conversation",
    targetId: conversationId,
    details: { userId: targetUserId },
    req
  });

  return participants;
}

async function transferOwner(
  conversationId,
  actorId,
  targetUserId,
  previousOwnerRole = "admin",
  req = null
) {
  const participants = await conversationRepository.transferGroupOwner(
    conversationId,
    actorId,
    targetUserId,
    previousOwnerRole
  );

  const actor = await userRepository.findById(actorId);
  await auditService.log({
    actorId,
    actorRole: actor?.role || "user",
    action: "group.transfer_owner",
    targetType: "conversation",
    targetId: conversationId,
    details: { userId: targetUserId, previousOwnerRole },
    req
  });

  return participants;
}

module.exports = {
  createGroup,
  updateGroup,
  addParticipant,
  removeParticipant,
  transferOwner
};