const config = require("../config/env");
const { isAllowedReaction } = require("./emoji");

const ICON_NAME_REGEX = /^([a-z0-9-]+):([a-z0-9][a-z0-9-]*[a-z0-9])$/;
const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function parseIconName(iconName) {
  if (typeof iconName !== "string") return null;
  const value = iconName.trim();
  if (value.length > 120) return null;
  if (/[<>"'`\s/\\]/.test(value)) return null;
  if (/^(?:https?:|data:|javascript:)/i.test(value)) return null;
  if (value.toLowerCase().includes("<svg") || value.toLowerCase().includes("<script")) return null;

  const match = ICON_NAME_REGEX.exec(value);
  if (!match) return null;
  return {
    prefix: match[1],
    name: match[2],
    iconName: value
  };
}

function isAllowedIconPrefix(prefix) {
  return typeof prefix === "string" && config.iconAllowedPrefixes.includes(prefix.toLowerCase());
}

function isValidIconName(iconName) {
  const parsed = parseIconName(iconName);
  return Boolean(parsed && isAllowedIconPrefix(parsed.prefix));
}

function validateIconName(iconName) {
  const parsed = parseIconName(iconName);
  if (!parsed) {
    throw new Error("Icon không hợp lệ.");
  }
  if (!isAllowedIconPrefix(parsed.prefix)) {
    throw new Error("Icon prefix không được hỗ trợ.");
  }
  return parsed.iconName;
}

function normalizeIconColor(color) {
  if (color === undefined || color === null || color === "") return null;
  if (typeof color !== "string") {
    throw new Error("Màu icon không hợp lệ.");
  }
  const value = color.trim();
  if (!value) return null;
  if (!HEX_COLOR_REGEX.test(value)) {
    throw new Error("Màu icon chỉ hỗ trợ hex #RGB hoặc #RRGGBB.");
  }
  return value.toLowerCase();
}

function validateIconColor(color) {
  return normalizeIconColor(color);
}

function isEmojiReaction(value) {
  return isAllowedReaction(value);
}

function isIconReaction(value) {
  return isValidIconName(value);
}

function normalizeReactionPayload(payload = {}) {
  if (payload.emoji !== undefined && !payload.reactionType) {
    const emoji = String(payload.emoji || "").trim();
    if (!isEmojiReaction(emoji)) {
      throw new Error("Emoji reaction không được hỗ trợ.");
    }
    return { reactionType: "emoji", value: emoji, color: null };
  }

  const reactionType = String(payload.reactionType || "emoji").trim().toLowerCase();
  const rawValue = payload.value !== undefined ? payload.value : payload.emoji;

  if (reactionType === "emoji") {
    const emoji = String(rawValue || "").trim();
    if (!isEmojiReaction(emoji)) {
      throw new Error("Emoji reaction không được hỗ trợ.");
    }
    return { reactionType: "emoji", value: emoji, color: null };
  }

  if (reactionType === "icon") {
    return {
      reactionType: "icon",
      value: validateIconName(rawValue),
      color: normalizeIconColor(payload.color)
    };
  }

  throw new Error("Loại reaction không hợp lệ.");
}

module.exports = {
  parseIconName,
  isValidIconName,
  isAllowedIconPrefix,
  validateIconName,
  validateIconColor,
  normalizeIconColor,
  isEmojiReaction,
  isIconReaction,
  normalizeReactionPayload
};