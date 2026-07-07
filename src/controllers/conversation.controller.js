const conversationRepository = require("../repositories/conversation.repository");
const conversationService = require("../services/conversation.service");
const { getDatabaseError } = require("../db");

async function getPublicRoom(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const room = await conversationRepository.getPublicRoomForUser(req.user.id);
    return res.json({ ok: true, room });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể tải phòng public."
    });
  }
}

async function listGroups(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const groups = await conversationRepository.listGroupsForUser(req.user.id);
    return res.json({ ok: true, groups });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể tải danh sách nhóm."
    });
  }
}

async function createGroup(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const group = await conversationService.createGroup(
      req.user.id,
      {
        name: req.body?.name,
        memberIds: Array.isArray(req.body?.memberIds) ? req.body.memberIds : []
      },
      req
    );
    return res.status(201).json({ ok: true, group });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể tạo nhóm."
    });
  }
}

async function updateGroup(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const group = await conversationService.updateGroup(
      req.params.id,
      req.user.id,
      {
        name: req.body?.name,
        avatarUrl: req.body?.avatarUrl
      },
      req
    );
    return res.json({ ok: true, group });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể cập nhật nhóm."
    });
  }
}

async function addParticipant(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const participants = await conversationService.addParticipant(
      req.params.id,
      req.user.id,
      req.body?.userId,
      req
    );
    return res.json({ ok: true, participants });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể thêm thành viên."
    });
  }
}

async function removeParticipant(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const participants = await conversationService.removeParticipant(
      req.params.id,
      req.user.id,
      req.params.userId,
      req
    );
    return res.json({ ok: true, participants });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể xóa thành viên."
    });
  }
}

async function getParticipants(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const allowed = await conversationRepository.canAccessConversation(
      req.params.id,
      req.user.id
    );
    if (!allowed) {
      return res.status(403).json({ ok: false, error: "Không có quyền truy cập." });
    }

    const participants = await conversationRepository.listParticipants(
      req.params.id
    );
    return res.json({ ok: true, participants });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể tải thành viên."
    });
  }
}

async function transferOwner(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const participants = await conversationService.transferOwner(
      req.params.id,
      req.user.id,
      req.body?.userId,
      req.body?.previousOwnerRole,
      req
    );
    return res.json({ ok: true, participants });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể chuyển quyền chủ nhóm."
    });
  }
}

async function leaveGroup(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const participants = await conversationService.removeParticipant(
      req.params.id,
      req.user.id,
      req.user.id,
      req
    );
    return res.json({ ok: true, participants });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể rời nhóm."
    });
  }
}

module.exports = {
  getPublicRoom,
  listGroups,
  createGroup,
  updateGroup,
  addParticipant,
  removeParticipant,
  transferOwner,
  getParticipants,
  leaveGroup
};