const { query } = require("../db");

async function listRecentIcons(userId, limit) {
  const result = await query(
    `SELECT icon_name, icon_color, used_at
     FROM user_recent_icons
     WHERE user_id = $1
     ORDER BY used_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows.map((row) => ({
    iconName: row.icon_name,
    iconColor: row.icon_color || null,
    usedAt: row.used_at
  }));
}

async function upsertRecentIcon(userId, iconName, iconColor) {
  await query(
    `INSERT INTO user_recent_icons (user_id, icon_name, icon_color, used_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id, icon_name) DO UPDATE
     SET icon_color = EXCLUDED.icon_color,
         used_at = now()`,
    [userId, iconName, iconColor || null]
  );
}

async function deleteRecentIcon(userId, iconName) {
  await query(
    `DELETE FROM user_recent_icons WHERE user_id = $1 AND icon_name = $2`,
    [userId, iconName]
  );
}

async function trimRecentIcons(userId, maxRecent) {
  await query(
    `DELETE FROM user_recent_icons
     WHERE user_id = $1
       AND icon_name NOT IN (
         SELECT icon_name
         FROM user_recent_icons
         WHERE user_id = $1
         ORDER BY used_at DESC
         LIMIT $2
       )`,
    [userId, maxRecent]
  );
}

module.exports = {
  listRecentIcons,
  upsertRecentIcon,
  deleteRecentIcon,
  trimRecentIcons
};