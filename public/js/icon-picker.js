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

  // Section 1: Recent Icons (Gần đây)
  const recentSection = document.createElement("div");
  recentSection.className = "icon-picker-section is-hidden";
  const recentTitle = document.createElement("h4");
  recentTitle.textContent = "Sử dụng gần đây";
  recentTitle.className = "icon-picker-section-title";
  const recentGrid = document.createElement("div");
  recentGrid.className = "icon-picker-grid-horizontal";
  recentSection.append(recentTitle, recentGrid);

  // Search input
  const search = document.createElement("input");
  search.className = "icon-picker-search";
  search.type = "search";
  search.placeholder = "Tìm icon (ví dụ: heart, star, user...)...";
  search.maxLength = 80;

  // Quick Tags
  const quickTagsContainer = document.createElement("div");
  quickTagsContainer.className = "icon-picker-quick-tags";
  const QUICK_TAGS = [
    { label: "⭐ Phổ biến", q: "" },
    { label: "❤️ Tim", q: "heart" },
    { label: "👍 Thích", q: "thumb" },
    { label: "😊 Cười", q: "smile" },
    { label: "🔥 Lửa", q: "flame" },
    { label: "👥 Nhóm", q: "group" }
  ];

  for (const tag of QUICK_TAGS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-picker-tag-btn";
    if (tag.q === "") btn.classList.add("is-active");
    btn.textContent = tag.label;
    btn.addEventListener("click", () => {
      quickTagsContainer.querySelectorAll("button").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      search.value = tag.q;
      searchIcons();
    });
    quickTagsContainer.append(btn);
  }

  const prefixTabs = document.createElement("div");
  prefixTabs.className = "icon-picker-prefix-tabs";
  const colorRow = document.createElement("div");
  colorRow.className = "icon-picker-color-row";

  // Section 2: Icons Grid (Tất cả)
  const allSection = document.createElement("div");
  allSection.className = "icon-picker-section";
  const grid = document.createElement("div");
  grid.className = "icon-picker-grid";
  const status = document.createElement("p");
  status.className = "icon-picker-status";
  allSection.append(grid);

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
        // re-render grids to apply new color live!
        searchIcons();
        loadRecentIcons();
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
      if (safeColor) {
        currentColor = safeColor;
        searchIcons();
        loadRecentIcons();
      }
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
    if (!q) {
      // Local popular icons fallback: instant load, no network query!
      const fallback = POPULAR_ICONS
        .filter((iconName) => !activePrefix || iconName.startsWith(`${activePrefix}:`))
        .map((iconName) => ({ iconName }));
      renderIcons(fallback);
      return;
    }

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
        .filter((iconName) => iconName.includes(q.toLowerCase()))
        .map((iconName) => ({ iconName }));
      renderIcons(fallback);
    }
  }

  async function loadRecentIcons() {
    if (typeof window === "undefined" || typeof window.api !== "function") return;
    try {
      const res = await window.api("/api/icons/recent");
      if (res.ok && Array.isArray(res.icons) && res.icons.length > 0) {
        recentSection.classList.remove("is-hidden");
        recentGrid.replaceChildren();
        for (const item of res.icons) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "icon-picker-item-mini";
          button.title = item.iconName;
          const iconColor = item.iconColor || currentColor;
          const icon = createIconElement(item.iconName, iconColor, "icon-picker-symbol-mini");
          if (icon) button.append(icon);
          button.addEventListener("click", () => {
            onSelect?.({ iconName: item.iconName, color: iconColor });
            close();
          });
          recentGrid.append(button);
        }
      } else {
        recentSection.classList.add("is-hidden");
      }
    } catch (_) {
      recentSection.classList.add("is-hidden");
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
    // remove active state from quick tags when manually typing
    quickTagsContainer.querySelectorAll("button").forEach(b => b.classList.remove("is-active"));
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
  panel.append(title, recentSection, search, quickTagsContainer, prefixTabs, colorRow, status, allSection);
  backdrop.append(panel);
  document.body.append(backdrop);

  searchIcons();
  loadRecentIcons();
  search.focus();
}

function openReactionPicker(messageId) {
  // Prevent duplicate reaction pickers
  const existing = document.querySelector(".reaction-picker-popover");
  if (existing) existing.remove();

  const picker = document.createElement("div");
  picker.className = "reaction-picker-popover";

  // Tab Header
  const tabHeader = document.createElement("div");
  tabHeader.className = "reaction-picker-tabs";
  
  const emojiTab = document.createElement("button");
  emojiTab.type = "button";
  emojiTab.className = "reaction-tab-btn is-active";
  emojiTab.textContent = "EMOJI";
  
  const iconTab = document.createElement("button");
  iconTab.type = "button";
  iconTab.className = "reaction-tab-btn";
  iconTab.textContent = "STICKER / ICON";
  
  tabHeader.append(emojiTab, iconTab);
  picker.append(tabHeader);

  // Tab Content Panels
  const emojiPanel = document.createElement("div");
  emojiPanel.className = "reaction-panel-content";

  const iconPanel = document.createElement("div");
  iconPanel.className = "reaction-panel-content is-hidden";

  picker.append(emojiPanel, iconPanel);

  // --- EMOJI PANEL LOGIC ---
  const EMOJI_CATEGORIES = [
    {
      id: "smileys",
      title: "Biểu cảm",
      icon: "😀",
      emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😋", "😛", "😜", "🤪", "😎", "🥳", "😏", "😒", "😔", "😢", "😭", "😡", "😱", "😴", "🤔", "🫣", "🤫", "😐", "😑", "😬", "🙄"]
    },
    {
      id: "gestures",
      title: "Bàn tay",
      icon: "👍",
      emojis: ["👍", "👎", "👊", "✊", "🤛", "🤜", "🤞", "✌️", "🤟", "🤘", "👌", "👈", "👉", "👆", "👇", "👋", "💪", "🙏", "👏", "🙌", "👐"]
    },
    {
      id: "hearts",
      title: "Trái tim",
      icon: "❤️",
      emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "❤️‍🔥", "💖", "💗", "💓", "💞", "💕", "❣️"]
    }
  ];

  const emojiScrollArea = document.createElement("div");
  emojiScrollArea.className = "emoji-scroll-area";
  emojiPanel.append(emojiScrollArea);

  for (const cat of EMOJI_CATEGORIES) {
    const title = document.createElement("div");
    title.className = "emoji-category-title";
    title.id = `cat-${messageId}-${cat.id}`;
    title.textContent = cat.title;
    emojiScrollArea.append(title);

    const grid = document.createElement("div");
    grid.className = "emoji-grid-content";
    for (const emoji of cat.emojis) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "emoji-btn-item";
      btn.textContent = emoji;
      btn.addEventListener("click", () => {
        if (typeof window !== "undefined" && typeof window.addReaction === "function") {
          window.addReaction(messageId, "emoji", emoji);
        }
        picker.remove();
      });
      grid.append(btn);
    }
    emojiScrollArea.append(grid);
  }

  // Emoji Bottom Navigation (Category icons)
  const emojiNav = document.createElement("div");
  emojiNav.className = "picker-bottom-nav";
  for (const cat of EMOJI_CATEGORIES) {
    const navBtn = document.createElement("button");
    navBtn.type = "button";
    navBtn.className = "picker-nav-btn";
    navBtn.textContent = cat.icon;
    navBtn.addEventListener("click", () => {
      const target = emojiScrollArea.querySelector(`#cat-${messageId}-${cat.id}`);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
    emojiNav.append(navBtn);
  }
  emojiPanel.append(emojiNav);


  // --- ICONIFY PANEL LOGIC ---
  // Section 1: Recent Icons (Gần đây)
  const recentSection = document.createElement("div");
  recentSection.className = "icon-picker-section is-hidden";
  const recentTitle = document.createElement("h4");
  recentTitle.textContent = "Gần đây";
  recentTitle.className = "icon-picker-section-title";
  const recentGrid = document.createElement("div");
  recentGrid.className = "icon-picker-grid-horizontal";
  recentSection.append(recentTitle, recentGrid);

  // Search input
  const search = document.createElement("input");
  search.className = "icon-picker-search";
  search.type = "search";
  search.placeholder = "Tìm sticker/icon (heart, star...)...";
  search.maxLength = 80;

  // Quick Tags
  const quickTagsContainer = document.createElement("div");
  quickTagsContainer.className = "icon-picker-quick-tags";
  const QUICK_TAGS = [
    { label: "⭐ Phổ biến", q: "" },
    { label: "❤️ Tim", q: "heart" },
    { label: "👍 Thích", q: "thumb" },
    { label: "😊 Cười", q: "smile" },
    { label: "🔥 Lửa", q: "flame" }
  ];

  for (const tag of QUICK_TAGS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-picker-tag-btn";
    if (tag.q === "") btn.classList.add("is-active");
    btn.textContent = tag.label;
    btn.addEventListener("click", () => {
      quickTagsContainer.querySelectorAll("button").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      search.value = tag.q;
      searchIcons();
    });
    quickTagsContainer.append(btn);
  }

  const prefixTabs = document.createElement("div");
  prefixTabs.className = "icon-picker-prefix-tabs";
  const colorRow = document.createElement("div");
  colorRow.className = "icon-picker-color-row";

  // Section 2: Icons Grid (Tất cả)
  const allSection = document.createElement("div");
  allSection.className = "icon-picker-section";
  const grid = document.createElement("div");
  grid.className = "icon-picker-grid";
  const status = document.createElement("p");
  status.className = "icon-picker-status";
  allSection.append(grid);

  let activePrefix = "";
  const st = (typeof window !== "undefined" && window.state) ? window.state : {};
  let currentColor = "#ef4444";

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
        searchIcons();
        loadRecentIcons();
      });
      colorRow.append(button);
    }
  }

  function renderIcons(icons) {
    grid.replaceChildren();
    const safeIcons = icons.filter((item) => isSafeIconName(item.iconName || item));
    if (!safeIcons.length) {
      status.textContent = "Không tìm thấy icon.";
      return;
    }
    status.textContent = "";
    for (const item of safeIcons) {
      const iconName = item.iconName || item;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "icon-picker-item";
      const icon = createIconElement(iconName, currentColor, "icon-picker-symbol");
      if (icon) button.append(icon);
      
      const label = document.createElement("span");
      label.textContent = iconName.split(":")[1];
      button.append(label);

      button.addEventListener("click", () => {
        if (typeof window !== "undefined" && typeof window.addReaction === "function") {
          window.addReaction(messageId, "icon", iconName, currentColor);
        }
        // Save to recent
        if (typeof window !== "undefined" && typeof window.api === "function") {
          window.api("/api/icons/recent", {
            method: "POST",
            body: JSON.stringify({ iconName, color: currentColor })
          }).catch(() => {});
        }
        picker.remove();
      });
      grid.append(button);
    }
  }

  async function searchIcons() {
    const q = search.value.trim();
    if (!q) {
      const fallback = POPULAR_ICONS
        .filter((iconName) => !activePrefix || iconName.startsWith(`${activePrefix}:`))
        .map((iconName) => ({ iconName }));
      renderIcons(fallback);
      return;
    }

    const max = (st.iconConfig && st.iconConfig.maxSearchResults) || 30;
    const params = new URLSearchParams({ q, limit: String(max) });
    if (activePrefix) params.set("prefix", activePrefix);
    status.textContent = "Đang tải...";
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
        .filter((iconName) => iconName.includes(q.toLowerCase()))
        .map((iconName) => ({ iconName }));
      renderIcons(fallback);
    }
  }

  async function loadRecentIcons() {
    if (typeof window === "undefined" || typeof window.api !== "function") return;
    try {
      const res = await window.api("/api/icons/recent");
      if (res.ok && Array.isArray(res.icons) && res.icons.length > 0) {
        recentSection.classList.remove("is-hidden");
        recentGrid.replaceChildren();
        for (const item of res.icons.slice(0, 10)) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "icon-picker-item-mini";
          button.title = item.iconName;
          const iconColor = item.iconColor || currentColor;
          const icon = createIconElement(item.iconName, iconColor, "icon-picker-symbol-mini");
          if (icon) button.append(icon);
          button.addEventListener("click", () => {
            if (typeof window !== "undefined" && typeof window.addReaction === "function") {
              window.addReaction(messageId, "icon", item.iconName, iconColor);
            }
            picker.remove();
          });
          recentGrid.append(button);
        }
      } else {
        recentSection.classList.add("is-hidden");
      }
    } catch (_) {
      recentSection.classList.add("is-hidden");
    }
  }

  // Prefix tabs navigation at the bottom of Iconify tab
  const iconNav = document.createElement("div");
  iconNav.className = "picker-bottom-nav";
  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "picker-nav-text-btn is-active";
  allBtn.textContent = "All";
  allBtn.addEventListener("click", () => {
    activePrefix = "";
    iconNav.querySelectorAll("button").forEach(b => b.classList.remove("is-active"));
    allBtn.classList.add("is-active");
    searchIcons();
  });
  iconNav.append(allBtn);

  const prefixes = (st.iconConfig && st.iconConfig.allowedPrefixes) || ["lucide", "mdi"];
  for (const prefix of prefixes) {
    const prefixBtn = document.createElement("button");
    prefixBtn.type = "button";
    prefixBtn.className = "picker-nav-text-btn";
    prefixBtn.textContent = prefix;
    prefixBtn.addEventListener("click", () => {
      activePrefix = prefix;
      iconNav.querySelectorAll("button").forEach(b => b.classList.remove("is-active"));
      prefixBtn.classList.add("is-active");
      searchIcons();
    });
    iconNav.append(prefixBtn);
  }

  search.addEventListener("input", () => {
    quickTagsContainer.querySelectorAll("button").forEach(b => b.classList.remove("is-active"));
    if (st) {
      window.clearTimeout(st.iconSearchTimer);
      st.iconSearchTimer = window.setTimeout(searchIcons, 250);
    } else {
      window.setTimeout(searchIcons, 250);
    }
  });

  renderColors();
  iconPanel.append(recentSection, search, quickTagsContainer, colorRow, status, allSection, iconNav);

  // Tab switching logic
  emojiTab.addEventListener("click", () => {
    emojiTab.classList.add("is-active");
    iconTab.classList.remove("is-active");
    emojiPanel.classList.remove("is-hidden");
    iconPanel.classList.add("is-hidden");
  });

  iconTab.addEventListener("click", () => {
    iconTab.classList.add("is-active");
    emojiTab.classList.remove("is-active");
    iconPanel.classList.remove("is-hidden");
    emojiPanel.classList.add("is-hidden");
    searchIcons();
    loadRecentIcons();
  });

  // Append popover to message row
  const row = (typeof window !== "undefined" && window.state && window.state.messageRows) ? window.state.messageRows.get(messageId) : null;
  if (row) {
    row.append(picker);
  }

  // Click outside to close
  function onOutsideClick(e) {
    if (!picker.contains(e.target) && !e.target.closest(".message-action-btn")) {
      picker.remove();
      document.removeEventListener("click", onOutsideClick);
    }
  }
  // Delay slightly to prevent immediate close from the click that opened it
  window.setTimeout(() => {
    document.addEventListener("click", onOutsideClick);
  }, 50);
}

function openChatInputPicker(messageForm, onSelectEmoji, onSelectIcon) {
  // Prevent duplicate reaction pickers
  const existing = document.querySelector(".reaction-picker-popover");
  if (existing) existing.remove();

  const picker = document.createElement("div");
  picker.className = "reaction-picker-popover chat-input-picker-popover";

  // Tab Header
  const tabHeader = document.createElement("div");
  tabHeader.className = "reaction-picker-tabs";
  
  const emojiTab = document.createElement("button");
  emojiTab.type = "button";
  emojiTab.className = "reaction-tab-btn is-active";
  emojiTab.textContent = "EMOJI";
  
  const iconTab = document.createElement("button");
  iconTab.type = "button";
  iconTab.className = "reaction-tab-btn";
  iconTab.textContent = "STICKER / ICON";
  
  tabHeader.append(emojiTab, iconTab);
  picker.append(tabHeader);

  // Tab Content Panels
  const emojiPanel = document.createElement("div");
  emojiPanel.className = "reaction-panel-content";

  const iconPanel = document.createElement("div");
  iconPanel.className = "reaction-panel-content is-hidden";

  picker.append(emojiPanel, iconPanel);

  // --- EMOJI PANEL LOGIC ---
  const EMOJI_CATEGORIES = [
    {
      id: "smileys",
      title: "Biểu cảm",
      icon: "😀",
      emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😋", "😛", "😜", "🤪", "😎", "🥳", "😏", "😒", "😔", "😢", "😭", "😡", "😱", "😴", "🤔", "🫣", "🤫", "😐", "😑", "😬", "🙄"]
    },
    {
      id: "gestures",
      title: "Bàn tay",
      icon: "👍",
      emojis: ["👍", "👎", "👊", "✊", "🤛", "🤜", "🤞", "✌️", "🤟", "🤘", "👌", "👈", "👉", "👆", "👇", "👋", "💪", "🙏", "👏", "🙌", "👐"]
    },
    {
      id: "hearts",
      title: "Trái tim",
      icon: "❤️",
      emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "❤️‍🔥", "💖", "💗", "💓", "💞", "💕", "❣️"]
    }
  ];

  const emojiScrollArea = document.createElement("div");
  emojiScrollArea.className = "emoji-scroll-area";
  emojiPanel.append(emojiScrollArea);

  for (const cat of EMOJI_CATEGORIES) {
    const title = document.createElement("div");
    title.className = "emoji-category-title";
    title.id = `cat-input-${cat.id}`;
    title.textContent = cat.title;
    emojiScrollArea.append(title);

    const grid = document.createElement("div");
    grid.className = "emoji-grid-content";
    for (const emoji of cat.emojis) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "emoji-btn-item";
      btn.textContent = emoji;
      btn.addEventListener("click", () => {
        onSelectEmoji(emoji);
      });
      grid.append(btn);
    }
    emojiScrollArea.append(grid);
  }

  // Emoji Bottom Navigation (Category icons)
  const emojiNav = document.createElement("div");
  emojiNav.className = "picker-bottom-nav";
  for (const cat of EMOJI_CATEGORIES) {
    const navBtn = document.createElement("button");
    navBtn.type = "button";
    navBtn.className = "picker-nav-btn";
    navBtn.textContent = cat.icon;
    navBtn.addEventListener("click", () => {
      const target = emojiScrollArea.querySelector(`#cat-input-${cat.id}`);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
    emojiNav.append(navBtn);
  }
  emojiPanel.append(emojiNav);


  // --- ICONIFY PANEL LOGIC ---
  // Section 1: Recent Icons (Gần đây)
  const recentSection = document.createElement("div");
  recentSection.className = "icon-picker-section is-hidden";
  const recentTitle = document.createElement("h4");
  recentTitle.textContent = "Gần đây";
  recentTitle.className = "icon-picker-section-title";
  const recentGrid = document.createElement("div");
  recentGrid.className = "icon-picker-grid-horizontal";
  recentSection.append(recentTitle, recentGrid);

  // Search input
  const search = document.createElement("input");
  search.className = "icon-picker-search";
  search.type = "search";
  search.placeholder = "Tìm sticker/icon (heart, star...)...";
  search.maxLength = 80;

  // Quick Tags
  const quickTagsContainer = document.createElement("div");
  quickTagsContainer.className = "icon-picker-quick-tags";
  const QUICK_TAGS = [
    { label: "⭐ Phổ biến", q: "" },
    { label: "❤️ Tim", q: "heart" },
    { label: "👍 Thích", q: "thumb" },
    { label: "😊 Cười", q: "smile" },
    { label: "🔥 Lửa", q: "flame" }
  ];

  for (const tag of QUICK_TAGS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-picker-tag-btn";
    if (tag.q === "") btn.classList.add("is-active");
    btn.textContent = tag.label;
    btn.addEventListener("click", () => {
      quickTagsContainer.querySelectorAll("button").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      search.value = tag.q;
      searchIcons();
    });
    quickTagsContainer.append(btn);
  }

  const prefixTabs = document.createElement("div");
  prefixTabs.className = "icon-picker-prefix-tabs";
  const colorRow = document.createElement("div");
  colorRow.className = "icon-picker-color-row";

  // Section 2: Icons Grid (Tất cả)
  const allSection = document.createElement("div");
  allSection.className = "icon-picker-section";
  const grid = document.createElement("div");
  grid.className = "icon-picker-grid";
  const status = document.createElement("p");
  status.className = "icon-picker-status";
  allSection.append(grid);

  let activePrefix = "";
  const st = (typeof window !== "undefined" && window.state) ? window.state : {};
  let currentColor = "#ef4444";

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
        searchIcons();
        loadRecentIcons();
      });
      colorRow.append(button);
    }
  }

  function renderIcons(icons) {
    grid.replaceChildren();
    const safeIcons = icons.filter((item) => isSafeIconName(item.iconName || item));
    if (!safeIcons.length) {
      status.textContent = "Không tìm thấy icon.";
      return;
    }
    status.textContent = "";
    for (const item of safeIcons) {
      const iconName = item.iconName || item;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "icon-picker-item";
      const icon = createIconElement(iconName, currentColor, "icon-picker-symbol");
      if (icon) button.append(icon);
      
      const label = document.createElement("span");
      label.textContent = iconName.split(":")[1];
      button.append(label);

      button.addEventListener("click", () => {
        onSelectIcon(iconName, currentColor);
        // Save to recent
        if (typeof window !== "undefined" && typeof window.api === "function") {
          window.api("/api/icons/recent", {
            method: "POST",
            body: JSON.stringify({ iconName, color: currentColor })
          }).catch(() => {});
        }
        picker.remove();
      });
      grid.append(button);
    }
  }

  async function searchIcons() {
    const q = search.value.trim();
    if (!q) {
      const fallback = POPULAR_ICONS
        .filter((iconName) => !activePrefix || iconName.startsWith(`${activePrefix}:`))
        .map((iconName) => ({ iconName }));
      renderIcons(fallback);
      return;
    }

    const max = (st.iconConfig && st.iconConfig.maxSearchResults) || 30;
    const params = new URLSearchParams({ q, limit: String(max) });
    if (activePrefix) params.set("prefix", activePrefix);
    status.textContent = "Đang tải...";
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
        .filter((iconName) => iconName.includes(q.toLowerCase()))
        .map((iconName) => ({ iconName }));
      renderIcons(fallback);
    }
  }

  async function loadRecentIcons() {
    if (typeof window === "undefined" || typeof window.api !== "function") return;
    try {
      const res = await window.api("/api/icons/recent");
      if (res.ok && Array.isArray(res.icons) && res.icons.length > 0) {
        recentSection.classList.remove("is-hidden");
        recentGrid.replaceChildren();
        for (const item of res.icons.slice(0, 10)) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "icon-picker-item-mini";
          button.title = item.iconName;
          const iconColor = item.iconColor || currentColor;
          const icon = createIconElement(item.iconName, iconColor, "icon-picker-symbol-mini");
          if (icon) button.append(icon);
          button.addEventListener("click", () => {
            onSelectIcon(item.iconName, iconColor);
            picker.remove();
          });
          recentGrid.append(button);
        }
      } else {
        recentSection.classList.add("is-hidden");
      }
    } catch (_) {
      recentSection.classList.add("is-hidden");
    }
  }

  // Prefix tabs navigation at the bottom of Iconify tab
  const iconNav = document.createElement("div");
  iconNav.className = "picker-bottom-nav";
  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "picker-nav-text-btn is-active";
  allBtn.textContent = "All";
  allBtn.addEventListener("click", () => {
    activePrefix = "";
    iconNav.querySelectorAll("button").forEach(b => b.classList.remove("is-active"));
    allBtn.classList.add("is-active");
    searchIcons();
  });
  iconNav.append(allBtn);

  const prefixes = (st.iconConfig && st.iconConfig.allowedPrefixes) || ["lucide", "mdi"];
  for (const prefix of prefixes) {
    const prefixBtn = document.createElement("button");
    prefixBtn.type = "button";
    prefixBtn.className = "picker-nav-text-btn";
    prefixBtn.textContent = prefix;
    prefixBtn.addEventListener("click", () => {
      activePrefix = prefix;
      iconNav.querySelectorAll("button").forEach(b => b.classList.remove("is-active"));
      prefixBtn.classList.add("is-active");
      searchIcons();
    });
    iconNav.append(prefixBtn);
  }

  search.addEventListener("input", () => {
    quickTagsContainer.querySelectorAll("button").forEach(b => b.classList.remove("is-active"));
    if (st) {
      window.clearTimeout(st.iconSearchTimer);
      st.iconSearchTimer = window.setTimeout(searchIcons, 250);
    } else {
      window.setTimeout(searchIcons, 250);
    }
  });

  renderColors();
  iconPanel.append(recentSection, search, quickTagsContainer, colorRow, status, allSection, iconNav);

  // Tab switching logic
  emojiTab.addEventListener("click", () => {
    emojiTab.classList.add("is-active");
    iconTab.classList.remove("is-active");
    emojiPanel.classList.remove("is-hidden");
    iconPanel.classList.add("is-hidden");
  });

  iconTab.addEventListener("click", () => {
    iconTab.classList.add("is-active");
    emojiTab.classList.remove("is-active");
    iconPanel.classList.remove("is-hidden");
    emojiPanel.classList.add("is-hidden");
    searchIcons();
    loadRecentIcons();
  });

  if (messageForm) {
    messageForm.append(picker);
  }

  function onOutsideClick(e) {
    if (!picker.contains(e.target) && !e.target.closest("#chatEmojiButton")) {
      picker.remove();
      document.removeEventListener("click", onOutsideClick);
    }
  }
  window.setTimeout(() => {
    document.addEventListener("click", onOutsideClick);
  }, 50);
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
  window.openChatInputPicker = openChatInputPicker;
}
