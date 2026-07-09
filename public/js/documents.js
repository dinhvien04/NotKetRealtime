(function () {
  const { api, getAccessKey, formatFileSize, showToast } = window.NotKetApi;
  const { uploadFile } = window.NotKetMediaUpload;

  const messageList = document.getElementById("message-list");
  const messageInput = document.getElementById("message-input");
  const sendBtn = document.getElementById("send-btn");
  const attachBtn = document.getElementById("attach-btn");
  const fileInput = document.getElementById("file-input");
  const searchInput = document.getElementById("search-input");
  const filterBtns = document.querySelectorAll(".filter-btn");
  const storageFill = document.getElementById("storage-fill");
  const storageText = document.getElementById("storage-text");
  const recentImages = document.getElementById("recent-images");
  const recentFiles = document.getElementById("recent-files");
  const uploadProgress = document.getElementById("upload-progress");
  const uploadProgressFill = document.getElementById("upload-progress-fill");
  const uploadProgressText = document.getElementById("upload-progress-text");
  const sidebar = document.getElementById("sidebar");
  const infoPanel = document.getElementById("info-panel");

  let currentType = "all";
  let searchQuery = "";
  let searchTimer = null;
  let openMode = false;
  let loading = false;

  function dayKey(dateValue) {
    const d = new Date(dateValue);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function formatDayLabel(dateValue) {
    const d = new Date(dateValue);
    return d.toLocaleDateString("vi-VN", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function formatTime(dateValue) {
    return new Date(dateValue).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function ensureAccess() {
    if (openMode) return true;
    if (getAccessKey()) return true;
    window.location.href = "/";
    return false;
  }

  function createMeta(message) {
    const meta = document.createElement("div");
    meta.className = "bubble-meta";

    const time = document.createElement("span");
    time.textContent = formatTime(message.createdAt);
    meta.appendChild(time);

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Xóa";
    del.addEventListener("click", () => deleteMessage(message.id));
    meta.appendChild(del);

    return meta;
  }

  function renderTextBubble(message) {
    const row = document.createElement("div");
    row.className = "message-row";
    row.dataset.id = message.id;

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = message.body || "";

    row.appendChild(bubble);
    row.appendChild(createMeta(message));
    return row;
  }

  function renderImageBubble(message) {
    const row = document.createElement("div");
    row.className = "message-row";
    row.dataset.id = message.id;

    const bubble = document.createElement("div");
    bubble.className = "bubble image-card";

    if (message.fileUrl) {
      const img = document.createElement("img");
      img.loading = "lazy";
      img.alt = message.fileName || "Ảnh";
      img.src = message.fileUrl;
      img.addEventListener("click", () => openFile(message));
      bubble.appendChild(img);
    }

    if (message.body) {
      const caption = document.createElement("div");
      caption.className = "caption";
      caption.textContent = message.body;
      bubble.appendChild(caption);
    }

    row.appendChild(bubble);
    row.appendChild(createMeta(message));
    return row;
  }

  function renderFileBubble(message) {
    const row = document.createElement("div");
    row.className = "message-row";
    row.dataset.id = message.id;

    const bubble = document.createElement("div");
    bubble.className = "bubble file-card";

    const icon = document.createElement("div");
    icon.className = "file-icon";
    icon.textContent = "📄";

    const meta = document.createElement("div");
    meta.className = "file-meta";

    const name = document.createElement("div");
    name.className = "file-name";
    name.textContent = message.fileName || "file";

    const size = document.createElement("div");
    size.className = "file-size";
    size.textContent = formatFileSize(message.fileSize);

    meta.appendChild(name);
    meta.appendChild(size);

    const link = document.createElement("a");
    link.href = "#";
    link.rel = "noopener noreferrer";
    link.textContent = "Mở";
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openFile(message);
    });

    bubble.appendChild(icon);
    bubble.appendChild(meta);
    bubble.appendChild(link);

    row.appendChild(bubble);
    row.appendChild(createMeta(message));
    return row;
  }

  function renderMessages(messages) {
    clearNode(messageList);

    if (!messages.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Chưa có nội dung. Hãy gửi tin nhắn hoặc tải file lên.";
      messageList.appendChild(empty);
      return;
    }

    // API returns newest first; show oldest at top
    const ordered = [...messages].reverse();
    let lastDay = null;

    for (const message of ordered) {
      const key = dayKey(message.createdAt);
      if (key !== lastDay) {
        lastDay = key;
        const sep = document.createElement("div");
        sep.className = "date-separator";
        sep.textContent = formatDayLabel(message.createdAt);
        messageList.appendChild(sep);
      }

      if (message.type === "image") {
        messageList.appendChild(renderImageBubble(message));
      } else if (message.type === "file") {
        messageList.appendChild(renderFileBubble(message));
      } else {
        messageList.appendChild(renderTextBubble(message));
      }
    }

    messageList.scrollTop = messageList.scrollHeight;
  }

  async function openFile(message) {
    try {
      let url = message.fileUrl;
      if (message.fileKey) {
        const refreshed = await api("/api/uploads/refresh-url", {
          method: "POST",
          body: JSON.stringify({ fileKey: message.fileKey })
        });
        url = refreshed.fileUrl || url;
      }
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        showToast("Không có URL file.", "error");
      }
    } catch (error) {
      showToast(error.message || "Không mở được file.", "error");
    }
  }

  async function loadMessages() {
    if (loading) return;
    loading = true;
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (searchQuery) params.set("q", searchQuery);
      if (currentType && currentType !== "all") params.set("type", currentType);

      const data = await api(`/api/messages?${params.toString()}`);
      renderMessages(data.messages || []);
    } catch (error) {
      if (error.status === 401) {
        window.location.href = "/";
        return;
      }
      showToast(error.message || "Không tải được tin nhắn.", "error");
    } finally {
      loading = false;
    }
  }

  async function loadStorage() {
    try {
      const data = await api("/api/storage/usage");
      const used = Number(data.usedBytes) || 0;
      const limit = Number(data.limitBytes) || 1;
      const pct = Math.min(100, Math.round((used / limit) * 100));
      storageFill.style.width = `${pct}%`;
      storageText.textContent = `${formatFileSize(used)} / ${formatFileSize(limit)} (${pct}%)`;

      clearNode(recentImages);
      (data.images || []).forEach((item) => {
        if (!item.fileUrl) return;
        const img = document.createElement("img");
        img.loading = "lazy";
        img.alt = item.fileName || "Ảnh";
        img.src = item.fileUrl;
        img.addEventListener("click", () => openFile(item));
        recentImages.appendChild(img);
      });

      clearNode(recentFiles);
      (data.files || []).forEach((item) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = "#";
        a.rel = "noopener noreferrer";
        a.textContent = item.fileName || "file";
        a.addEventListener("click", (event) => {
          event.preventDefault();
          openFile(item);
        });
        li.appendChild(a);
        recentFiles.appendChild(li);
      });
    } catch (_error) {
      /* ignore panel errors */
    }
  }

  async function sendText() {
    const body = (messageInput.value || "").trim();
    if (!body) return;
    sendBtn.disabled = true;
    try {
      await api("/api/messages", {
        method: "POST",
        body: JSON.stringify({ type: "text", body })
      });
      messageInput.value = "";
      await loadMessages();
    } catch (error) {
      showToast(error.message || "Gửi thất bại.", "error");
    } finally {
      sendBtn.disabled = false;
      messageInput.focus();
    }
  }

  function setUploadProgress(visible, pct = 0, text = "Đang tải lên...") {
    if (visible) {
      uploadProgress.classList.remove("hidden");
      uploadProgressFill.style.width = `${pct}%`;
      uploadProgressText.textContent = text;
    } else {
      uploadProgress.classList.add("hidden");
      uploadProgressFill.style.width = "0%";
    }
  }

  async function handleFile(file) {
    if (!file) return;
    const kind = file.type && file.type.startsWith("image/") ? "image" : "file";
    setUploadProgress(true, 0, `Đang tải ${file.name}...`);
    try {
      const upload = await uploadFile(file, kind, (pct) => {
        setUploadProgress(true, pct, `Đang tải ${file.name}... ${pct}%`);
      });

      setUploadProgress(true, 100, "Đang xác nhận...");
      await api("/api/messages/file", {
        method: "POST",
        body: JSON.stringify({
          fileKey: upload.fileKey,
          fileName: upload.fileName,
          mimeType: upload.mimeType,
          size: upload.size,
          kind: upload.kind,
          caption: ""
        })
      });

      showToast("Upload thành công.", "success");
      await loadMessages();
      await loadStorage();
    } catch (error) {
      showToast(error.message || "Upload thất bại.", "error");
    } finally {
      setUploadProgress(false);
      fileInput.value = "";
    }
  }

  async function deleteMessage(id) {
    if (!confirm("Xóa tin nhắn này?")) return;
    try {
      await api(`/api/messages/${id}`, { method: "DELETE" });
      await loadMessages();
      await loadStorage();
    } catch (error) {
      showToast(error.message || "Xóa thất bại.", "error");
    }
  }

  function bindUi() {
    sendBtn.addEventListener("click", sendText);
    messageInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendText();
      }
    });

    attachBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      if (file) handleFile(file);
    });

    filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        filterBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentType = btn.dataset.type || "all";
        loadMessages();
      });
    });

    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        searchQuery = (searchInput.value || "").trim();
        loadMessages();
      }, 250);
    });

    document.getElementById("sidebar-open")?.addEventListener("click", () => {
      sidebar.classList.add("open");
    });
    document.getElementById("sidebar-close")?.addEventListener("click", () => {
      sidebar.classList.remove("open");
    });
    document.getElementById("toggle-info")?.addEventListener("click", () => {
      infoPanel.classList.toggle("open");
    });
    document.getElementById("info-close")?.addEventListener("click", () => {
      infoPanel.classList.remove("open");
    });
    document.getElementById("focus-search")?.addEventListener("click", () => {
      sidebar.classList.add("open");
      searchInput.focus();
    });
  }

  async function init() {
    try {
      const config = await api("/api/app/config");
      openMode = Boolean(config.openMode);
    } catch (_error) {
      openMode = false;
    }

    if (!ensureAccess()) return;
    bindUi();
    await loadMessages();
    await loadStorage();
  }

  init();
})();
