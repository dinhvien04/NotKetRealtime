const config = require("../config/env");
const iconRepository = require("../repositories/icon.repository");
const { validateIconName, normalizeIconColor, isAllowedIconPrefix, parseIconName } = require("../utils/icon");

const POPULAR_ICONS = [
  "lucide:heart",
  "lucide:thumbs-up",
  "lucide:smile",
  "lucide:star",
  "lucide:flame",
  "lucide:party-popper",
  "lucide:zap",
  "lucide:check",
  "lucide:x",
  "lucide:globe-2",
  "lucide:users",
  "mdi:account-group",
  "mdi:robot",
  "mdi:chat",
  "mdi:image",
  "material-symbols:favorite",
  "material-symbols:thumb-up"
];

const cache = new Map();

function toIconItem(iconName) {
  const parsed = parseIconName(iconName);
  if (!parsed || !isAllowedIconPrefix(parsed.prefix)) return null;
  return {
    iconName,
    label: parsed.name,
    prefix: parsed.prefix
  };
}

function validateIconSelection({ iconName, color }) {
  return {
    iconName: validateIconName(iconName),
    iconColor: normalizeIconColor(color)
  };
}

async function listRecentIcons(userId) {
  return iconRepository.listRecentIcons(userId, config.iconMaxRecent);
}

async function rememberIcon(userId, iconName, color) {
  const selection = validateIconSelection({ iconName, color });
  await iconRepository.upsertRecentIcon(userId, selection.iconName, selection.iconColor);
  await iconRepository.trimRecentIcons(userId, config.iconMaxRecent);
  return selection;
}

function fallbackSearch(query, prefix, limit) {
  const q = String(query || "").trim().toLowerCase();
  return POPULAR_ICONS
    .map(toIconItem)
    .filter(Boolean)
    .filter((item) => (!prefix || item.prefix === prefix) && (!q || item.iconName.includes(q) || item.label.includes(q)))
    .slice(0, limit);
}

async function searchIconify(query, prefix, limit) {
  const params = new URLSearchParams();
  params.set("query", String(query || "").trim() || "chat");
  params.set("limit", String(limit));
  if (prefix) params.set("prefix", prefix);
  const url = `https://api.iconify.design/search?${params.toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error("Iconify API failed");
    const data = await response.json();
    return (Array.isArray(data.icons) ? data.icons : [])
      .map(toIconItem)
      .filter(Boolean)
      .slice(0, limit);
  } finally {
    clearTimeout(timeout);
  }
}

async function searchIconSuggestions({ query = "", prefix = "", limit } = {}) {
  const normalizedPrefix = String(prefix || "").trim().toLowerCase();
  if (normalizedPrefix && !isAllowedIconPrefix(normalizedPrefix)) {
    throw new Error("Icon prefix không được hỗ trợ.");
  }
  const maxLimit = config.iconMaxSearchResults;
  const safeLimit = Math.max(1, Math.min(Number(limit) || maxLimit, maxLimit));
  const cacheKey = `${query}|${normalizedPrefix}|${safeLimit}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.icons;

  let icons = [];
  if (config.iconUseIconifyApi) {
    try {
      icons = await searchIconify(query, normalizedPrefix, safeLimit);
    } catch (_error) {
      icons = [];
    }
  }
  if (!icons.length) {
    icons = fallbackSearch(query, normalizedPrefix, safeLimit);
  }
  cache.set(cacheKey, { icons, expiresAt: Date.now() + 5 * 60 * 1000 });
  return icons;
}

module.exports = {
  POPULAR_ICONS,
  validateIconSelection,
  listRecentIcons,
  rememberIcon,
  searchIconSuggestions
};