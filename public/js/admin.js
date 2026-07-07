const page = document.body.dataset.page;
if (page !== "admin") {
  // noop
}

const state = {
  csrfToken: null,
  currentUser: null
};

const panels = {
  stats: document.getElementById("panelStats"),
  users: document.getElementById("panelUsers"),
  messages: document.getElementById("panelMessages"),
  badwords: document.getElementById("panelBadwords"),
  audit: document.getElementById("panelAudit")
};

async function ensureCsrfToken() {
  if (state.csrfToken) return state.csrfToken;
  const response = await fetch("/api/csrf-token", { credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok || !data.csrfToken) {
    throw new Error(data.error || "Không thể lấy CSRF token.");
  }
  state.csrfToken = data.csrfToken;
  return state.csrfToken;
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (options.method && options.method !== "GET") {
    const token = await ensureCsrfToken();
    headers["X-CSRF-Token"] = token;
  }
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "include"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "Yêu cầu thất bại.");
  }
  return data;
}

function showToast(message, type = "info") {
  const region = document.getElementById("toastRegion");
  if (!region) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  region.append(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN");
}

function createTableCell(text) {
  const td = document.createElement("td");
  td.textContent = String(text ?? "");
  return td;
}

function createAdminTable(headers) {
  const table = document.createElement("table");
  table.className = "admin-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const header of headers) {
    const th = document.createElement("th");
    th.textContent = header;
    headRow.append(th);
  }
  thead.append(headRow);
  table.append(thead);
  const tbody = document.createElement("tbody");
  table.append(tbody);
  return { table, tbody };
}

function switchPanel(name) {
  document.querySelectorAll(".admin-nav-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.panel === name);
  });
  Object.entries(panels).forEach(([key, panel]) => {
    panel?.classList.toggle("is-active", key === name);
  });
}

function renderStats(stats) {
  const grid = document.getElementById("statsGrid");
  if (!grid) return;
  const cards = [
    ["Người dùng", stats.totalUsers],
    ["Đang hoạt động", stats.activeUsers],
    ["Bị khóa", stats.lockedUsers],
    ["Tin nhắn", stats.totalMessages],
    ["Tin hôm nay", stats.messagesToday],
    ["File upload", stats.filesUploaded],
    ["Dung lượng", formatBytes(stats.storageUsedBytes)],
    ["Hội thoại 1-1", stats.conversations?.direct || 0],
    ["Nhóm", stats.conversations?.group || 0],
    ["Phòng public", stats.conversations?.public || 0]
  ];
  grid.replaceChildren(
    ...cards.map(([label, value]) => {
      const card = document.createElement("article");
      card.className = "admin-stat-card";
      const labelEl = document.createElement("span");
      labelEl.textContent = label;
      const valueEl = document.createElement("strong");
      valueEl.textContent = String(value ?? 0);
      card.append(labelEl, valueEl);
      return card;
    })
  );
}

function renderUsersTable(users) {
  const wrap = document.getElementById("usersTable");
  if (!wrap) return;
  if (!users.length) {
    wrap.textContent = "Không có dữ liệu.";
    return;
  }

  const { table, tbody } = createAdminTable([
    "Username",
    "Role",
    "Trạng thái",
    "Khóa",
    "Thao tác"
  ]);

  for (const user of users) {
    const row = document.createElement("tr");
    const lockLabel = user.isLocked ? "Mở khóa" : "Khóa";
    row.append(
      createTableCell(user.username),
      createTableCell(user.role),
      createTableCell(user.status),
      createTableCell(user.isLocked ? "Có" : "Không")
    );
    const actionsCell = document.createElement("td");
    actionsCell.className = "admin-actions";
    const actions = actionsCell;

    const lockBtn = document.createElement("button");
    lockBtn.type = "button";
    lockBtn.className = "admin-action-btn";
    lockBtn.textContent = lockLabel;
    lockBtn.addEventListener("click", async () => {
      try {
        await api(`/api/admin/users/${user.id}`, {
          method: "PATCH",
          body: JSON.stringify({ isLocked: !user.isLocked })
        });
        showToast("Đã cập nhật trạng thái khóa.", "success");
        loadUsers();
      } catch (error) {
        showToast(error.message, "error");
      }
    });
    actions.append(lockBtn);

    if (state.currentUser?.role === "admin" && user.id !== state.currentUser.id) {
      const roleBtn = document.createElement("button");
      roleBtn.type = "button";
      roleBtn.className = "admin-action-btn";
      roleBtn.textContent = user.role === "admin" ? "Hạ mod" : "Nâng admin";
      roleBtn.addEventListener("click", async () => {
        const nextRole = user.role === "admin" ? "moderator" : "admin";
        try {
          await api(`/api/admin/users/${user.id}`, {
            method: "PATCH",
            body: JSON.stringify({ role: nextRole })
          });
          showToast("Đã cập nhật role.", "success");
          loadUsers();
        } catch (error) {
          showToast(error.message, "error");
        }
      });
      actions.append(roleBtn);
    }

    row.append(actionsCell);
    tbody.append(row);
  }

  wrap.replaceChildren(table);
}

function renderMessagesTable(messages) {
  const wrap = document.getElementById("messagesTable");
  if (!wrap) return;
  if (!messages.length) {
    wrap.textContent = "Không có tin nhắn.";
    return;
  }

  const { table, tbody } = createAdminTable([
    "Người gửi",
    "Loại",
    "Nội dung",
    "Thời gian",
    ""
  ]);

  for (const message of messages) {
    const preview =
      message.type === "text"
        ? (message.message || message.body || "").slice(0, 80)
        : message.fileName || message.type;
    const row = document.createElement("tr");
    row.append(
      createTableCell(message.senderName || "-"),
      createTableCell(message.type),
      createTableCell(preview || "-"),
      createTableCell(formatDate(message.createdAt))
    );
    const actionsCell = document.createElement("td");
    actionsCell.className = "admin-actions";
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "admin-action-btn";
    deleteBtn.textContent = "Xóa";
    deleteBtn.addEventListener("click", async () => {
      if (!window.confirm("Xóa tin nhắn này?")) return;
      try {
        await api(`/api/admin/messages/${message.id}`, { method: "DELETE" });
        showToast("Đã xóa tin nhắn.", "success");
        loadMessages();
      } catch (error) {
        showToast(error.message, "error");
      }
    });
    actionsCell.append(deleteBtn);
    row.append(actionsCell);
    tbody.append(row);
  }

  wrap.replaceChildren(table);
}

function renderBadWordsTable(items) {
  const wrap = document.getElementById("badWordsTable");
  if (!wrap) return;
  if (!items.length) {
    wrap.textContent = "Chưa có từ cấm.";
    return;
  }

  const { table, tbody } = createAdminTable(["Từ", "Mức", "Thay thế", ""]);

  for (const item of items) {
    const row = document.createElement("tr");
    row.append(
      createTableCell(item.word),
      createTableCell(item.severity),
      createTableCell(item.replacement)
    );
    const actionsCell = document.createElement("td");
    actionsCell.className = "admin-actions";
    if (state.currentUser?.role === "admin") {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "admin-action-btn";
      deleteBtn.textContent = "Xóa";
      deleteBtn.addEventListener("click", async () => {
        try {
          await api(`/api/admin/bad-words/${item.id}`, { method: "DELETE" });
          showToast("Đã xóa từ cấm.", "success");
          loadBadWords();
        } catch (error) {
          showToast(error.message, "error");
        }
      });
      actionsCell.append(deleteBtn);
    }
    row.append(actionsCell);
    tbody.append(row);
  }

  wrap.replaceChildren(table);
}

function renderAuditTable(items) {
  const wrap = document.getElementById("auditTable");
  if (!wrap) return;
  if (!items.length) {
    wrap.textContent = "Chưa có audit log.";
    return;
  }

  const { table, tbody } = createAdminTable([
    "Thời gian",
    "Action",
    "Role",
    "Target"
  ]);

  for (const item of items) {
    const row = document.createElement("tr");
    const target = [item.targetType || "-", item.targetId || ""]
      .filter(Boolean)
      .join(" ");
    row.append(
      createTableCell(formatDate(item.createdAt)),
      createTableCell(item.action),
      createTableCell(item.actorRole || "-"),
      createTableCell(target)
    );
    tbody.append(row);
  }

  wrap.replaceChildren(table);
}

async function loadStats() {
  const data = await api("/api/admin/stats");
  renderStats(data.stats);
}

async function loadUsers(query = "") {
  const data = await api(`/api/admin/users?q=${encodeURIComponent(query)}`);
  renderUsersTable(data.users || []);
}

async function loadMessages(query = "") {
  const data = await api(`/api/admin/messages?q=${encodeURIComponent(query)}`);
  renderMessagesTable(data.messages || []);
}

async function loadBadWords() {
  const data = await api("/api/admin/bad-words");
  renderBadWordsTable(data.items || []);
}

async function loadAuditLogs() {
  const data = await api("/api/admin/audit-logs");
  renderAuditTable(data.items || []);
}

async function init() {
  try {
    const me = await api("/api/auth/me");
    state.currentUser = me.user;
    const usernameEl = document.getElementById("adminUsername");
    if (usernameEl) {
      usernameEl.textContent = me.user.displayName || me.user.username;
    }
    if (!["admin", "moderator"].includes(me.user.role)) {
      window.location.href = "/chat";
      return;
    }
    await loadStats();
    await loadUsers();
    await loadMessages();
    await loadBadWords();
    await loadAuditLogs();
  } catch (error) {
    showToast(error.message, "error");
    window.location.href = "/?auth=login";
  }
}

document.querySelectorAll(".admin-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchPanel(btn.dataset.panel));
});

document.getElementById("usersFilterForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const q = new FormData(form).get("q") || "";
  loadUsers(String(q));
});

document.getElementById("messagesFilterForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const q = new FormData(form).get("q") || "";
  loadMessages(String(q));
});

document.getElementById("badWordForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorEl = document.getElementById("badWordError");
  if (errorEl) errorEl.textContent = "";
  if (state.currentUser?.role !== "admin") {
    if (errorEl) errorEl.textContent = "Chỉ admin mới thêm từ cấm.";
    return;
  }
  const form = event.currentTarget;
  const data = new FormData(form);
  try {
    await api("/api/admin/bad-words", {
      method: "POST",
      body: JSON.stringify({
        word: data.get("word"),
        severity: data.get("severity")
      })
    });
    form.reset();
    showToast("Đã thêm từ cấm.", "success");
    loadBadWords();
  } catch (error) {
    if (errorEl) errorEl.textContent = error.message;
  }
});

init();