const { query } = require("../db");

async function addReaction({ messageId, userId, emoji, reactionType, value, color }) {
  const type = reactionType || "emoji";
  const reactionValue = value || emoji;
  await query(
    `INSERT INTO message_reactions (message_id, user_id, emoji, reaction_type, value, color)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (message_id, user_id, reaction_type, value) DO UPDATE
     SET color = EXCLUDED.color`,
    [messageId, userId, type === "emoji" ? reactionValue : null, type, reactionValue, color || null]
  );
}

async function removeReaction({ messageId, userId, emoji, reactionType, value }) {
  const type = reactionType || "emoji";
  const reactionValue = value || emoji;
  await query(
    `DELETE FROM message_reactions
     WHERE message_id = $1 AND user_id = $2 AND reaction_type = $3 AND value = $4`,
    [messageId, userId, type, reactionValue]
  );
}

async function listByMessageIds(messageIds) {
  if (!messageIds.length) return new Map();

  const result = await query(
    `SELECT mr.message_id, mr.user_id, mr.emoji, mr.reaction_type, mr.value, mr.color, mr.created_at,
            u.username, u.display_name
     FROM message_reactions mr
     JOIN users u ON u.id = mr.user_id
     WHERE mr.message_id = ANY($1::uuid[])
     ORDER BY mr.created_at ASC`,
    [messageIds]
  );

  const byMessage = new Map();
  for (const row of result.rows) {
    const type = row.reaction_type || "emoji";
    const reactionValue = row.value || row.emoji;
    if (!reactionValue) continue;
    if (!byMessage.has(row.message_id)) byMessage.set(row.message_id, new Map());

    const key = `${type}:${reactionValue}`;
    const messageReactions = byMessage.get(row.message_id);
    if (!messageReactions.has(key)) {
      messageReactions.set(key, {
        emoji: type === "emoji" ? reactionValue : undefined,
        type,
        value: reactionValue,
        color: type === "icon" ? row.color || null : null,
        count: 0,
        userId: row.user_id,
        users: []
      });
    }

    const reaction = messageReactions.get(key);
    reaction.count += 1;
    reaction.users.push({
      id: row.user_id,
      userId: row.user_id,
      username: row.username,
      displayName: row.display_name || row.username,
      createdAt: row.created_at
    });
  }

  const grouped = new Map();
  for (const [messageId, reactions] of byMessage.entries()) {
    grouped.set(messageId, Array.from(reactions.values()));
  }
  return grouped;
}

module.exports = {
  addReaction,
  removeReaction,
  listByMessageIds
};