// icon-picker.js - extracted Iconify picker (no raw SVG, uses <iconify-icon> + backend validate)
const ICON_NAME_PATTERN = /^([a-z0-9-]+):([a-z0-9][a-z0-9-]*[a-z0-9])$/;
const ICON_COLOR_PRESETS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"];
const POPULAR_ICONS = ["lucide:heart", "lucide:thumbs-up", "lucide:smile", "lucide:star", "lucide:flame", "lucide:party-popper", "lucide:zap", "lucide:check", "lucide:x", "lucide:globe-2", "lucide:users", "mdi:account-group", "mdi:robot", "mdi:chat", "mdi:image", "material-symbols:favorite", "material-symbols:thumb-up"];

function isSafeIconName(iconName) {
  if (typeof window !== "undefined" && window.state && window.state.iconConfig) {
    return typeof iconName === "string" &&
      iconName.length <= 120 &&
      ICON_NAME_PATTERN.test(iconName) &&
      window.state.iconConfig.allowedPrefixes.includes(iconName.split(":")[0]);
  }
  // fallback defaults
  return typeof iconName === "string" &&
    iconName.length <= 120 &&
    ICON_NAME_PATTERN.test(iconName);
}

function normalizeHexColor(color) {
  if (!color) return null;
  const value = String(color).trim().toLowerCase();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(value) ? value : null;
}

function createIconElement(iconName, color, className = "reaction-icon") {
  if (!isSafeIconName(iconName)) return null;
  const icon = document.createElement("iconify-icon");
  icon.className = className;
  icon.setAttribute("icon", iconName);
  const safeColor = normalizeHexColor(color);
  if (safeColor) icon.style.color = safeColor;
  return icon;
}

function createIconPicker({ onSelect, selectedIconName = "lucide:heart", selectedColor = "#ef4444" } = {}) {
  const backdrop = document.createElement("div");
  backdrop.className = "icon-picker-backdrop";
  const panel = document.createElement("div");
  panel.className = "icon-picker-panel";
  const title = document.createElement("h3");
  title.textContent = "Chọn Iconify icon";
  const search = document.createElement("input");
  search.className = "icon-picker-search";
  search.type = "search";
  search.placeholder = "Tìm icon...";
  search.maxLength = 80;
  const prefixTabs = document.createElement("div");
  prefixTabs.className = "icon-picker-prefix-tabs";
  const colorRow = document.createElement("div");
  colorRow.className = "icon-picker-color-row";
  const grid = document.createElement("div");
  grid.className = "icon-picker-grid";
  const status = document.createElement("p");
  status.className = "icon-picker-status";
  let activePrefix = "";
  const st = (typeof window !== "undefined" && window.state) ? window.state : {};
  let currentColor = normalizeHexColor(selectedColor) || "#ef4444";

  function close() {
    backdrop.remove();
    if (st.iconSearchTimer) {
      window.clearTimeout(st.iconSearchTimer);
    }
  }

  function renderColors() {
    colorRow.replaceChildren();
    for (const color of ICON_COLOR_PRESETS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "icon-picker-color";
      button.style.backgroundColor = color;
      button.setAttribute("aria-label", color);
      if (color === currentColor) button.classList.add("is-selected");
      button.addEventListener("click", () => {
        currentColor = color;
        renderColors();
      });
      colorRow.append(button);
    }
    const custom = document.createElement("input");
    custom.type = "text";
    custom.maxLength = 7;
    custom.value = currentColor;
    custom.setAttribute("aria-label", "Màu hex");
    custom.addEventListener("change", () => {
      const safeColor = normalizeHexColor(custom.value);
      if (safeColor) currentColor = safeColor;
      custom.value = currentColor;
      renderColors();
    });
    colorRow.append(custom);
  }

  function renderIcons(icons) {
    grid.replaceChildren();
    const safeIcons = icons.filter((item) => isSafeIconName(item.iconName || item));
    if (!safeIcons.length) {
      status.textContent = "Không có icon phù hợp.";
      return;
    }
    status.textContent = "";
    for (const item of safeIcons) {
      const iconName = item.iconName || item;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "icon-picker-item";
      if (iconName === selectedIconName) button.classList.add("is-selected");
      const icon = createIconElement(iconName, currentColor, "icon-picker-symbol");
      const label = document.createElement("span");
      label.textContent = iconName.split(":")[1];
      if (icon) button.append(icon);
      button.append(label);
      button.addEventListener("click", () => {
        onSelect?.({ iconName, color: currentColor });
        // remember via api if available
        if (typeof window !== "undefined" && typeof window.api === "function") {
          window.api("/api/icons/recent", {
            method: "POST",
            body: JSON.stringify({ iconName, color: currentColor })
          }).catch(() => {});
        }
        close();
      });
      grid.append(button);
    }
  }

  async function searchIcons() {
    const q = search.value.trim();
    const max = (st.iconConfig && st.iconConfig.maxSearchResults) || 60;
    const params = new URLSearchParams({ q, limit: String(max) });
    if (activePrefix) params.set("prefix", activePrefix);
    status.textContent = "Đang tải icon...";
    try {
      if (typeof window !== "undefined" && typeof window.api === "function") {
        const result = await window.api(`/api/icons/search?${params.toString()}`);
        renderIcons(result.icons || []);
      } else {
        throw new Error("no api");
      }
    } catch (_error) {
      const fallback = POPULAR_ICONS
        .filter((iconName) => !activePrefix || iconName.startsWith(`${activePrefix}:`))
        .filter((iconName) => !q || iconName.includes(q.toLowerCase()))
        .map((iconName) => ({ iconName }));
      renderIcons(fallback);
    }
  }

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = "is-active";
  allButton.textContent = "all";
  allButton.addEventListener("click", () => {
    activePrefix = "";
    prefixTabs.querySelectorAll("button").forEach((button) => button.classList.remove("is-active"));
    allButton.classList.add("is-active");
    searchIcons();
  });
  prefixTabs.append(allButton);

  const prefixes = (st.iconConfig && st.iconConfig.allowedPrefixes) || ["lucide", "mdi", "material-symbols"];
  for (const prefix of prefixes) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = prefix;
    button.addEventListener("click", () => {
      activePrefix = prefix;
      prefixTabs.querySelectorAll("button").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      searchIcons();
    });
    prefixTabs.append(button);
  }

  search.addEventListener("input", () => {
    if (st) {
      window.clearTimeout(st.iconSearchTimer);
      st.iconSearchTimer = window.setTimeout(searchIcons, 250);
    } else {
      window.setTimeout(searchIcons, 250);
    }
  });
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener("keydown", function onKeydown(event) {
    if (event.key === "Escape" && document.body.contains(backdrop)) {
      document.removeEventListener("keydown", onKeydown);
      close();
    }
  });

  renderColors();
  panel.append(title, search, prefixTabs, colorRow, status, grid);
  backdrop.append(panel);
  document.body.append(backdrop);

  searchIcons();
  search.focus();
}

function openReactionPicker(messageId) {
  const picker = document.createElement("div");
  picker.className = "reaction-picker";
  const ALLOWED_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "👏"];
  for (const emoji of ALLOWED_REACTIONS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "reaction-btn";
    btn.textContent = emoji;
    btn.addEventListener("click", () => {
      if (typeof window !== "undefined" && typeof window.addReaction === "function") {
        window.addReaction(messageId, "emoji", emoji);
      }
      picker.remove();
    });
    picker.append(btn);
  }
  const iconButton = document.createElement("button");
  iconButton.type = "button";
  iconButton.className = "reaction-btn";
  iconButton.textContent = "Icon";
  iconButton.addEventListener("click", () => {
    picker.remove();
    if (typeof window !== "undefined" && typeof window.createIconPicker === "function") {
      window.createIconPicker({
        onSelect: ({ iconName, color }) => {
          if (typeof window !== "undefined" && typeof window.addReaction === "function") {
            window.addReaction(messageId, "icon", iconName, color);
          }
        }
      });
    }
  });
  picker.append(iconButton);
  const row = (typeof window !== "undefined" && window.state && window.state.messageRows) ? window.state.messageRows.get(messageId) : null;
  if (row) {
    row.append(picker);
    window.setTimeout(() => picker.remove(), 4000);
  }
}

// expose for bootstrap client
if (typeof window !== "undefined") {
  window.ICON_NAME_PATTERN = ICON_NAME_PATTERN;
  window.ICON_COLOR_PRESETS = ICON_COLOR_PRESETS;
  window.POPULAR_ICONS = POPULAR_ICONS;
  window.isSafeIconName = isSafeIconName;
  window.normalizeHexColor = normalizeHexColor;
  window.createIconElement = createIconElement;
  window.createIconPicker = createIconPicker;
  window.openReactionPicker = openReactionPicker;
}
