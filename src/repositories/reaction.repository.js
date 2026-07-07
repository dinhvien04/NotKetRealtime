const { query } = require("../db");

async function addReaction({ messageId, userId, emoji }) {
  await query(
    `INSERT INTO message_reactions (message_id, user_id, emoji)
     VALUES ($1, $2, $3)
     ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
    [messageId, userId, emoji]
  );
}

async function removeReaction({ messageId, userId, emoji }) {
  await query(
    `DELETE FROM message_reactions
     WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
    [messageId, userId, emoji]
  );
}

async function listByMessageIds(messageIds) {
  if (!messageIds.length) return new Map();

  const result = await query(
    `SELECT mr.message_id, mr.user_id, mr.emoji, mr.created_at,
            u.username, u.display_name
     FROM message_reactions mr
     JOIN users u ON u.id = mr.user_id
     WHERE mr.message_id = ANY($1::uuid[])
     ORDER BY mr.created_at ASC`,
    [messageIds]
  );

  const grouped = new Map();
  for (const row of result.rows) {
    if (!grouped.has(row.message_id)) {
      grouped.set(row.message_id, []);
    }
    grouped.get(row.message_id).push({
      emoji: row.emoji,
      userId: row.user_id,
      username: row.username,
      displayName: row.display_name || row.username,
      createdAt: row.created_at
    });
  }
  return grouped;
}

module.exports = {
  addReaction,
  removeReaction,
  listByMessageIds
};