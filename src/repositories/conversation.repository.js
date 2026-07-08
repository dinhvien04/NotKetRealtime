const crypto = require("crypto");
const { query, withTransaction } = require("../db");

const PUBLIC_SLUG = "public-main";

function mapConversationRow(row) {
  return {
    id: row.id,
    type: row.type,
    name: row.name || null,
    avatarUrl: row.avatar_url || null,
    iconName: row.icon_name || null,
    iconColor: row.icon_color || null,
    slug: row.slug || null,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeDirectPair(userA, userB) {
  return userA < userB
    ? { userLow: userA, userHigh: userB }
    : { userLow: userB, userHigh: userA };
}

function directConversationLockKeys(userLow, userHigh) {
  const hash = crypto
    .createHash("sha256")
    .update(`${userLow}:${userHigh}`)
    .digest();
  return [hash.readInt32BE(0), hash.readInt32BE(4)];
}

async function findDirectConversation(userA, userB) {
  const { userLow, userHigh } = normalizeDirectPair(userA, userB);
  const result = await query(
    `SELECT dc.conversation_id
     FROM direct_conversations dc
     WHERE dc.user_low = $1 AND dc.user_high = $2`,
    [userLow, userHigh]
  );
  return result.rows[0]?.conversation_id || null;
}

async function findOrCreateDirectConversation(userA, userB) {
  const { userLow, userHigh } = normalizeDirectPair(userA, userB);
  const [lockKey1, lockKey2] = directConversationLockKeys(userLow, userHigh);

  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [
      lockKey1,
      lockKey2
    ]);

    const existing = await client.query(
      `SELECT conversation_id FROM direct_conversations
       WHERE user_low = $1 AND user_high = $2`,
      [userLow, userHigh]
    );
    if (existing.rows[0]) {
      return existing.rows[0].conversation_id;
    }

    const conversation = await client.query(
      `INSERT INTO conversations (type) VALUES ('direct') RETURNING id`
    );
    const conversationId = conversation.rows[0].id;

    await client.query(
      `INSERT INTO direct_conversations (conversation_id, user_low, user_high)
       VALUES ($1, $2, $3)`,
      [conversationId, userLow, userHigh]
    );

    await client.query(
      `INSERT INTO conversation_participants (conversation_id, user_id, role)
       VALUES ($1, $2, 'member'), ($1, $3, 'member')
       ON CONFLICT DO NOTHING`,
      [conversationId, userA, userB]
    );

    return conversationId;
  });
}

async function findOrphanDirectConversations() {
  const result = await query(
    `SELECT c.id
     FROM conversations c
     LEFT JOIN direct_conversations dc ON dc.conversation_id = c.id
     WHERE c.type = 'direct' AND dc.conversation_id IS NULL`
  );
  return result.rows.map((row) => row.id);
}

async function getById(conversationId) {
  const result = await query(`SELECT * FROM conversations WHERE id = $1`, [
    conversationId
  ]);
  const row = result.rows[0];
  return row ? mapConversationRow(row) : null;
}

async function conversationExists(conversationId) {
  const result = await query(
    `SELECT 1 FROM conversations WHERE id = $1`,
    [conversationId]
  );
  return result.rowCount > 0;
}

async function isParticipant(conversationId, userId) {
  const result = await query(
    `SELECT 1 FROM conversation_participants
     WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return result.rowCount > 0;
}

async function ensureParticipant(conversationId, userId, role = "member") {
  await query(
    `INSERT INTO conversation_participants (conversation_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (conversation_id, user_id) DO NOTHING`,
    [conversationId, userId, role]
  );
}

async function getParticipantRole(conversationId, userId) {
  const result = await query(
    `SELECT role FROM conversation_participants
     WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return result.rows[0]?.role || null;
}

async function getOtherParticipant(conversationId, userId) {
  const result = await query(
    `SELECT u.id, u.username, u.display_name, u.avatar_url
     FROM conversation_participants cp
     JOIN users u ON u.id = cp.user_id
     WHERE cp.conversation_id = $1 AND cp.user_id <> $2
     LIMIT 1`,
    [conversationId, userId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    avatarUrl: row.avatar_url || null
  };
}

async function getParticipantIds(conversationId) {
  const result = await query(
    `SELECT user_id FROM conversation_participants WHERE conversation_id = $1`,
    [conversationId]
  );
  return result.rows.map((row) => row.user_id);
}

async function listParticipants(conversationId) {
  const result = await query(
    `SELECT u.id, u.username, u.display_name, u.avatar_url, cp.role, cp.joined_at
     FROM conversation_participants cp
     JOIN users u ON u.id = cp.user_id
     WHERE cp.conversation_id = $1
     ORDER BY cp.joined_at ASC`,
    [conversationId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    avatarUrl: row.avatar_url || null,
    role: row.role,
    joinedAt: row.joined_at
  }));
}

async function countUnread(conversationId, userId) {
  const result = await query(
    `SELECT cp.last_read_message_id
     FROM conversation_participants cp
     WHERE cp.conversation_id = $1 AND cp.user_id = $2`,
    [conversationId, userId]
  );
  const lastReadMessageId = result.rows[0]?.last_read_message_id || null;
  const params = [conversationId, userId];
  let readSql = "";

  if (lastReadMessageId) {
    params.push(lastReadMessageId);
    readSql = `AND m.created_at > (
      SELECT created_at FROM messages WHERE id = $3
    )`;
  }

  const countResult = await query(
    `SELECT COUNT(*)::int AS unread_count
     FROM messages m
     WHERE m.conversation_id = $1
       AND m.deleted_at IS NULL
       AND m.sender_id <> $2
       ${readSql}`,
    params
  );
  return countResult.rows[0]?.unread_count || 0;
}

async function listForUser(userId) {
  const result = await query(
    `SELECT
       c.id AS conversation_id,
       c.updated_at,
       lm.id AS last_message_id,
       lm.type AS last_message_type,
       lm.body AS last_message_body,
       lm.file_name AS last_message_file_name,
       lm.created_at AS last_message_created_at,
       lm.sender_id AS last_message_sender_id,
       other_user.id AS other_user_id,
       other_user.username AS other_username,
       other_user.display_name AS other_display_name,
       cp.last_read_message_id,
       (
         SELECT COUNT(*)::int
         FROM messages um
         WHERE um.conversation_id = c.id
           AND um.deleted_at IS NULL
           AND um.sender_id <> $1
           AND (
             cp.last_read_message_id IS NULL
             OR um.created_at > (
               SELECT created_at FROM messages WHERE id = cp.last_read_message_id
             )
           )
       ) AS unread_count
     FROM conversation_participants cp
     JOIN conversations c ON c.id = cp.conversation_id
     JOIN conversation_participants other_cp
       ON other_cp.conversation_id = c.id AND other_cp.user_id <> cp.user_id
     JOIN users other_user ON other_user.id = other_cp.user_id
     LEFT JOIN LATERAL (
       SELECT m.id, m.type, m.body, m.file_name, m.created_at, m.sender_id
       FROM messages m
       WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
       ORDER BY m.created_at DESC
       LIMIT 1
     ) lm ON true
     WHERE cp.user_id = $1 AND c.type = 'direct'
     ORDER BY COALESCE(lm.created_at, c.created_at) DESC`,
    [userId]
  );

  return result.rows.map((row) => ({
    conversationId: row.conversation_id,
    type: "direct",
    otherUser: {
      id: row.other_user_id,
      username: row.other_username,
      displayName: row.other_display_name || row.other_username
    },
    lastMessage: row.last_message_id
      ? {
          id: row.last_message_id,
          type: row.last_message_type,
          body: row.last_message_body || "",
          fileName: row.last_message_file_name || "",
          createdAt: row.last_message_created_at,
          senderId: row.last_message_sender_id
        }
      : null,
    unreadCount: row.unread_count || 0,
    updatedAt: row.updated_at
  }));
}

async function listGroupsForUser(userId) {
  const result = await query(
    `SELECT
       c.id AS conversation_id,
       c.name,
       c.avatar_url,
       c.icon_name,
       c.icon_color,
       c.updated_at,
       cp.role,
       lm.id AS last_message_id,
       lm.type AS last_message_type,
       lm.body AS last_message_body,
       lm.file_name AS last_message_file_name,
       lm.created_at AS last_message_created_at,
       lm.sender_id AS last_message_sender_id,
       (
         SELECT COUNT(*)::int
         FROM messages um
         WHERE um.conversation_id = c.id
           AND um.deleted_at IS NULL
           AND um.sender_id <> $1
           AND (
             cp.last_read_message_id IS NULL
             OR um.created_at > (
               SELECT created_at FROM messages WHERE id = cp.last_read_message_id
             )
           )
       ) AS unread_count
     FROM conversation_participants cp
     JOIN conversations c ON c.id = cp.conversation_id
     LEFT JOIN LATERAL (
       SELECT m.id, m.type, m.body, m.file_name, m.created_at, m.sender_id
       FROM messages m
       WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
       ORDER BY m.created_at DESC
       LIMIT 1
     ) lm ON true
     WHERE cp.user_id = $1 AND c.type = 'group'
     ORDER BY COALESCE(lm.created_at, c.updated_at) DESC`,
    [userId]
  );

  return result.rows.map((row) => ({
    conversationId: row.conversation_id,
    type: "group",
    name: row.name || "Nhóm chat",
    avatarUrl: row.avatar_url || null,
    iconName: row.icon_name || null,
    iconColor: row.icon_color || null,
    role: row.role,
    lastMessage: row.last_message_id
      ? {
          id: row.last_message_id,
          type: row.last_message_type,
          body: row.last_message_body || "",
          fileName: row.last_message_file_name || "",
          createdAt: row.last_message_created_at,
          senderId: row.last_message_sender_id
        }
      : null,
    unreadCount: row.unread_count || 0,
    updatedAt: row.updated_at
  }));
}

async function getPublicRoom() {
  const result = await query(
    `SELECT * FROM conversations WHERE type = 'public' AND slug = $1 LIMIT 1`,
    [PUBLIC_SLUG]
  );
  const row = result.rows[0];
  return row ? mapConversationRow(row) : null;
}

async function ensurePublicParticipant(userId) {
  const room = await getPublicRoom();
  if (!room) {
    throw new Error("Phòng public chưa được cấu hình.");
  }
  await ensureParticipant(room.id, userId, "member");
  return room;
}

async function getPublicRoomForUser(userId) {
  const room = await ensurePublicParticipant(userId);
  const unreadCount = await countUnread(room.id, userId);
  return {
    ...room,
    unreadCount
  };
}

async function createGroup({ name, ownerId, memberIds = [], iconName = null, iconColor = null }) {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) {
    throw new Error("Tên nhóm không được để trống.");
  }

  const uniqueMembers = [...new Set(memberIds.filter((id) => id && id !== ownerId))];

  return withTransaction(async (client) => {
    const conversation = await client.query(
      `INSERT INTO conversations (type, name, created_by, icon_name, icon_color)
       VALUES ('group', $1, $2, $3, $4)
       RETURNING *`,
      [trimmedName, ownerId, iconName || null, iconColor || null]
    );
    const conversationId = conversation.rows[0].id;

    await client.query(
      `INSERT INTO conversation_participants (conversation_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [conversationId, ownerId]
    );

    for (const memberId of uniqueMembers) {
      await client.query(
        `INSERT INTO conversation_participants (conversation_id, user_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT DO NOTHING`,
        [conversationId, memberId]
      );
    }

    return mapConversationRow(conversation.rows[0]);
  });
}

async function updateGroup(conversationId, userId, updates = {}) {
  const conversation = await getById(conversationId);
  if (!conversation || conversation.type !== "group") {
    throw new Error("Nhóm không tồn tại.");
  }

  const role = await getParticipantRole(conversationId, userId);
  if (!["owner", "admin"].includes(role)) {
    throw new Error("Bạn không có quyền cập nhật nhóm này.");
  }

  const fields = [];
  const params = [conversationId];
  let index = 2;

  if (updates.name !== undefined) {
    const trimmedName = String(updates.name).trim();
    if (!trimmedName) {
      throw new Error("Tên nhóm không hợp lệ.");
    }
    fields.push(`name = $${index++}`);
    params.push(trimmedName);
  }

  if (updates.avatarUrl !== undefined) {
    fields.push(`avatar_url = $${index++}`);
    params.push(updates.avatarUrl || null);
  }

  if (updates.iconName !== undefined) {
    fields.push(`icon_name = $${index++}`);
    params.push(updates.iconName || null);
  }

  if (updates.iconColor !== undefined) {
    fields.push(`icon_color = $${index++}`);
    params.push(updates.iconColor || null);
  }

  if (!fields.length) {
    return conversation;
  }

  fields.push("updated_at = now()");
  const result = await query(
    `UPDATE conversations SET ${fields.join(", ")} WHERE id = $1 RETURNING *`,
    params
  );
  return mapConversationRow(result.rows[0]);
}

async function addGroupParticipant(conversationId, actorId, targetUserId) {
  const conversation = await getById(conversationId);
  if (!conversation || conversation.type !== "group") {
    throw new Error("Nhóm không tồn tại.");
  }

  const role = await getParticipantRole(conversationId, actorId);
  if (!["owner", "admin"].includes(role)) {
    throw new Error("Bạn không có quyền thêm thành viên.");
  }

  await ensureParticipant(conversationId, targetUserId, "member");
  return listParticipants(conversationId);
}

async function removeGroupParticipant(conversationId, actorId, targetUserId) {
  const conversation = await getById(conversationId);
  if (!conversation || conversation.type !== "group") {
    throw new Error("Nhóm không tồn tại.");
  }

  const actorRole = await getParticipantRole(conversationId, actorId);
  const targetRole = await getParticipantRole(conversationId, targetUserId);

  if (!targetRole) {
    throw new Error("Thành viên không tồn tại trong nhóm.");
  }

  const isSelfLeave = actorId === targetUserId;
  if (isSelfLeave) {
    if (targetRole === "owner") {
      throw new Error("Chủ nhóm không thể rời nhóm. Hãy chuyển quyền trước.");
    }
  } else if (actorRole === "member") {
    throw new Error("Bạn không có quyền xóa thành viên.");
  } else if (actorRole === "admin") {
    if (targetRole === "owner" || targetRole === "admin") {
      throw new Error("Admin không thể xóa owner hoặc admin khác.");
    }
  } else if (actorRole === "owner") {
    if (targetRole === "owner") {
      throw new Error("Không thể xóa chủ nhóm.");
    }
  } else {
    throw new Error("Bạn không có quyền xóa thành viên.");
  }

  await query(
    `DELETE FROM conversation_participants
     WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, targetUserId]
  );

  return listParticipants(conversationId);
}

async function transferGroupOwner(
  conversationId,
  actorId,
  targetUserId,
  previousOwnerRole = "admin"
) {
  const conversation = await getById(conversationId);
  if (!conversation || conversation.type !== "group") {
    throw new Error("Nhóm không tồn tại.");
  }

  const actorRole = await getParticipantRole(conversationId, actorId);
  if (actorRole !== "owner") {
    throw new Error("Chỉ chủ nhóm mới có thể chuyển quyền.");
  }

  const targetRole = await getParticipantRole(conversationId, targetUserId);
  if (!targetRole) {
    throw new Error("Thành viên không tồn tại trong nhóm.");
  }

  if (targetUserId === actorId) {
    throw new Error("Không thể chuyển quyền cho chính mình.");
  }

  const demotedRole = previousOwnerRole === "member" ? "member" : "admin";

  return withTransaction(async (client) => {
    await client.query(
      `UPDATE conversation_participants
       SET role = $3
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, actorId, demotedRole]
    );
    await client.query(
      `UPDATE conversation_participants
       SET role = 'owner'
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, targetUserId]
    );
    return listParticipants(conversationId);
  });
}

async function canAccessConversation(conversationId, userId) {
  const conversation = await getById(conversationId);
  if (!conversation) return false;

  if (conversation.type === "public") {
    await ensureParticipant(conversationId, userId, "member");
    return true;
  }

  return isParticipant(conversationId, userId);
}

async function markRead(conversationId, userId, messageId) {
  await query(
    `UPDATE conversation_participants
     SET last_read_message_id = $3
     WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId, messageId]
  );
}

async function touchConversation(conversationId, client = null) {
  const runner = client || { query };
  await runner.query(
    `UPDATE conversations SET updated_at = now() WHERE id = $1`,
    [conversationId]
  );
}

module.exports = {
  findDirectConversation,
  findOrCreateDirectConversation,
  findOrphanDirectConversations,
  getById,
  conversationExists,
  isParticipant,
  ensureParticipant,
  getParticipantRole,
  getOtherParticipant,
  getParticipantIds,
  listParticipants,
  listForUser,
  listGroupsForUser,
  getPublicRoom,
  ensurePublicParticipant,
  getPublicRoomForUser,
  createGroup,
  updateGroup,
  addGroupParticipant,
  removeGroupParticipant,
  transferGroupOwner,
  canAccessConversation,
  countUnread,
  markRead,
  touchConversation
};