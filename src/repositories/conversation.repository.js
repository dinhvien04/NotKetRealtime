const { query, withTransaction } = require("../db");

async function findDirectConversation(userA, userB) {
  const userLow = userA < userB ? userA : userB;
  const userHigh = userA < userB ? userB : userA;
  const result = await query(
    `SELECT dc.conversation_id
     FROM direct_conversations dc
     WHERE dc.user_low = $1 AND dc.user_high = $2`,
    [userLow, userHigh]
  );
  return result.rows[0]?.conversation_id || null;
}

async function findOrCreateDirectConversation(userA, userB) {
  const existingId = await findDirectConversation(userA, userB);
  if (existingId) {
    return existingId;
  }

  return withTransaction(async (client) => {
    const again = await client.query(
      `SELECT conversation_id FROM direct_conversations
       WHERE user_low = $1 AND user_high = $2`,
      [userA < userB ? userA : userB, userA < userB ? userB : userA]
    );
    if (again.rows[0]) {
      return again.rows[0].conversation_id;
    }

    const conversation = await client.query(
      `INSERT INTO conversations (type) VALUES ('direct') RETURNING id`
    );
    const conversationId = conversation.rows[0].id;
    const userLow = userA < userB ? userA : userB;
    const userHigh = userA < userB ? userB : userA;

    await client.query(
      `INSERT INTO direct_conversations (conversation_id, user_low, user_high)
       VALUES ($1, $2, $3)`,
      [conversationId, userLow, userHigh]
    );

    await client.query(
      `INSERT INTO conversation_participants (conversation_id, user_id)
       VALUES ($1, $2), ($1, $3)`,
      [conversationId, userA, userB]
    );

    return conversationId;
  });
}

async function isParticipant(conversationId, userId) {
  const result = await query(
    `SELECT 1 FROM conversation_participants
     WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return result.rowCount > 0;
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
       cp.last_read_message_id
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
     WHERE cp.user_id = $1
     ORDER BY COALESCE(lm.created_at, c.created_at) DESC`,
    [userId]
  );

  return result.rows.map((row) => {
    const unread =
      row.last_message_id &&
      row.last_message_sender_id !== userId &&
      (!row.last_read_message_id ||
        row.last_message_id !== row.last_read_message_id);
    return {
      conversationId: row.conversation_id,
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
      unreadCount: unread ? 1 : 0,
      updatedAt: row.updated_at
    };
  });
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
  isParticipant,
  getOtherParticipant,
  listForUser,
  markRead,
  touchConversation
};