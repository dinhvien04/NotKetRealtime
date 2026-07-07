const ALLOWED_REACTIONS = new Set([
  "👍",
  "❤️",
  "😂",
  "😮",
  "😢",
  "🙏",
  "🔥",
  "👏"
]);

function isAllowedReaction(emoji) {
  if (typeof emoji !== "string") return false;
  const trimmed = emoji.trim();
  return ALLOWED_REACTIONS.has(trimmed);
}

module.exports = {
  ALLOWED_REACTIONS,
  isAllowedReaction
};