const page = document.body.dataset.page;
const MAX_UPLOAD_BYTES = 6291456;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
]);
const socket = page === "chat" ? io({ withCredentials: true }) : null;

const elements = {
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  loginTab: document.getElementById("loginTab"),
  registerTab: document.getElementById("registerTab"),
  loginError: document.getElementById("loginError"),
  registerError: document.getElementById("registerError"),
  currentUsername: document.getElementById("currentUsername"),
  currentAvatar: document.getElementById("currentAvatar"),
  onlineCount: document.getElementById("onlineCount"),
  conversationList: document.getElementById("conversationList"),
  userList: document.getElementById("userList"),
  emptyUsers: document.getElementById("emptyUsers"),
  emptyState: document.getElementById("emptyState"),
  chatPanel: document.getElementById("chatPanel"),
  selectedAvatar: document.getElementById("selectedAvatar"),
  selectedUsername: document.getElementById("selectedUsername"),
  selectedStatus: document.getElementById("selectedStatus"),
  messages: document.getElementById("messages"),
  typingStatus: document.getElementById("typingStatus"),
  typingText: document.getElementById("typingText"),
  messageForm: document.getElementById("messageForm"),
  messageInput: document.getElementById("messageInput"),
  sendButton: document.getElementById("sendButton"),
  attachButton: document.getElementById("attachButton"),
  fileInput: document.getElementById("fileInput"),
  selectedFilePreview: document.getElementById("selectedFilePreview"),
  selectedFileName: document.getElementById("selectedFileName"),
  selectedFileSize: document.getElementById("selectedFileSize"),
  removeFileButton: document.getElementById("removeFileButton"),
  inputHint: document.getElementById("inputHint"),
  connectionOverlay: document.getElementById("connectionOverlay"),
  toastRegion: document.getElementById("toastRegion"),
  logoutButton: document.getElementById("logoutButton"),
  mobileMenuButton: document.getElementById("mobileMenuButton"),
  sidebar: document.getElementById("sidebar"),
  sidebarBackdrop: document.getElementById("sidebarBackdrop")
};

const state = {
  currentUser: null,
  selectedUser: null,
  selectedConversationId: null,
  conversations: [],
  onlineUsers: [],
  unread: new Map(),
  hasJoined: false,
  isLoggingOut: false,
  isTyping: false,
  typingTimer: null,
  typingSenderTimer: null,
  selectedFile: null,
  isUploading: false,
  nextCursor: null,
  isLoadingOlder: false
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "Yêu cầu thất bại.");
  }
  return data;
}

function getInitials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part.charAt(0).toLocaleUpperCase("vi"))
    .join("");
}

function setAvatar(element, name) {
  if (element) element.textContent = getInitials(name);
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAllowedFile(file) {
  return Boolean(file) && ALLOWED_MIME_TYPES.has(file.type) && file.size <= MAX_UPLOAD_BYTES;
}

function showToast(message, type = "info") {
  if (!elements.toastRegion) return;
  const toast = document.createElement("div");
  toast.className = `toast${type === "error" ? " is-error" : ""}`;
  toast.textContent = message;
  elements.toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 3500);
}

function setConnectionVisible(visible) {
  elements.connectionOverlay?.classList.toggle("is-hidden", !visible);
}

function closeSidebar() {
  elements.sidebar?.classList.remove("is-open");
  elements.sidebarBackdrop?.classList.add("is-hidden");
}

function createDaySeparator() {
  const wrapper = document.createElement("div");
  const text = document.createElement("span");
  wrapper.className = "day-separator";
  text.textContent = "Hôm nay";
  wrapper.append(text);
  return wrapper;
}

function clearMessages() {
  elements.messages.replaceChildren(createDaySeparator());
}

function createImageBubble(message) {
  const link = document.createElement("a");
  const image = document.createElement("img");
  const fallback = document.createElement("span");
  link.className = "message-image-link";
  link.href = message.fileUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  image.className = "message-image";
  image.src = message.fileUrl;
  image.alt = message.fileName || "Ảnh đính kèm";
  image.loading = "lazy";
  image.addEventListener("error", () => {
    image.classList.add("is-hidden");
    fallback.classList.remove("is-hidden");
  });
  fallback.className = "message-image-fallback is-hidden";
  fallback.textContent = "Không thể tải ảnh.";
  link.append(image, fallback);
  return link;
}

function createFileBubble(message) {
  const card = document.createElement("a");
  const icon = document.createElement("span");
  const copy = document.createElement("span");
  const name = document.createElement("strong");
  const size = document.createElement("span");
  const action = document.createElement("span");
  card.className = "message-file-card";
  card.href = message.fileUrl;
  card.target = "_blank";
  card.rel = "noopener noreferrer";
  icon.className = "message-file-icon";
  icon.setAttribute("aria-hidden", "true");
  const iconSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  iconSvg.setAttribute("viewBox", "0 0 24 24");
  const p1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p1.setAttribute("d", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z");
  const p2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p2.setAttribute("d", "M14 2v6h6");
  iconSvg.append(p1, p2);
  icon.append(iconSvg);
  copy.className = "message-file-copy";
  name.textContent = message.fileName || "Tệp đính kèm";
  size.textContent = formatFileSize(message.size);
  action.className = "message-file-action";
  action.textContent = "Mở file";
  copy.append(name, size, action);
  card.append(icon, copy);
  return card;
}

function appendMessage(message) {
  const isOwn = message.senderId === state.currentUser?.id;
  const row = document.createElement("article");
  const bubble = document.createElement("div");
  const meta = document.createElement("span");
  const messageType = message.type || "text";
  row.className = `message-row${isOwn ? " is-own" : ""}`;
  bubble.className = `message-bubble${messageType === "image" ? " message-bubble-image" : ""}${messageType === "file" ? " message-bubble-file" : ""}`;
  if (messageType === "image") bubble.append(createImageBubble(message));
  else if (messageType === "file") bubble.append(createFileBubble(message));
  else bubble.textContent = message.message || message.body || message.text || "";
  meta.className = "message-meta";
  meta.textContent = isOwn
    ? `${message.time} • Đã gửi`
    : `${message.senderName} • ${message.time}`;
  row.append(bubble, meta);
  elements.messages.append(row);
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function appendSystemMessage(text) {
  const message = document.createElement("div");
  message.className = "system-message";
  message.textContent = text;
  elements.messages.append(message);
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function renderSelectedFilePreview(file) {
  if (!elements.selectedFilePreview || !file) return;
  elements.selectedFileName.textContent = file.name;
  elements.selectedFileSize.textContent = formatFileSize(file.size);
  elements.selectedFilePreview.classList.remove("is-hidden");
}

function clearSelectedFile() {
  state.selectedFile = null;
  if (elements.fileInput) elements.fileInput.value = "";
  elements.selectedFilePreview?.classList.add("is-hidden");
}

function setComposerDisabled(disabled) {
  const isOffline = elements.messageInput?.disabled && !state.isUploading;
  elements.sendButton.disabled = disabled || isOffline;
  if (elements.attachButton) elements.attachButton.disabled = disabled || isOffline;
}

function renderConversationHeader(user, isOnline) {
  const displayName = user.displayName || user.username;
  elements.selectedUsername.textContent = displayName;
  setAvatar(elements.selectedAvatar, displayName);
  elements.selectedStatus.classList.toggle("is-offline", !isOnline);
  elements.selectedStatus.lastChild.textContent = isOnline
    ? "Đang trực tuyến"
    : "Đã ngoại tuyến";
  elements.chatPanel.classList.toggle("is-offline", !isOnline);
  elements.messageInput.disabled = state.isUploading;
  elements.attachButton.disabled = state.isUploading;
  elements.sendButton.disabled = state.isUploading;
  elements.messageInput.placeholder = "Nhập tin nhắn...";
  elements.inputHint.textContent = state.isUploading
    ? "Đang tải file lên..."
    : isOnline
      ? "Nhấn Enter để gửi hoặc đính kèm ảnh/file."
      : "Người nhận đang offline. Tin nhắn vẫn được lưu vào database.";
}

function createConversationItem(conversation) {
  const button = document.createElement("button");
  const avatar = document.createElement("span");
  const copy = document.createElement("span");
  const name = document.createElement("strong");
  const preview = document.createElement("span");
  const user = conversation.otherUser;
  button.type = "button";
  button.className = "user-item";
  if (state.selectedConversationId === conversation.conversationId) {
    button.classList.add("is-active");
  }
  avatar.className = "avatar";
  setAvatar(avatar, user.displayName || user.username);
  copy.className = "user-copy";
  name.textContent = user.displayName || user.username;
  const last = conversation.lastMessage;
  preview.textContent = last
    ? last.type === "image"
      ? "Đã gửi ảnh"
      : last.type === "file"
        ? `File: ${last.fileName || "đính kèm"}`
        : last.body || "Tin nhắn mới"
    : "Bắt đầu trò chuyện";
  copy.append(name, preview);
  button.append(avatar, copy);
  if (conversation.unreadCount > 0) {
    const badge = document.createElement("span");
    badge.className = "unread-badge";
    badge.textContent = String(conversation.unreadCount);
    button.append(badge);
  }
  button.addEventListener("click", () => selectConversation(conversation));
  return button;
}

function createOnlineUserItem(user) {
  const button = document.createElement("button");
  const avatar = document.createElement("span");
  const copy = document.createElement("span");
  const name = document.createElement("strong");
  const status = document.createElement("span");
  button.type = "button";
  button.className = "user-item";
  if (state.selectedUser?.id === user.id && !state.selectedConversationId) {
    button.classList.add("is-active");
  }
  avatar.className = "avatar";
  setAvatar(avatar, user.displayName || user.username);
  copy.className = "user-copy";
  name.textContent = user.displayName || user.username;
  status.textContent = "Đang online";
  copy.append(name, status);
  button.append(avatar, copy);
  button.addEventListener("click", () => startChatWithOnlineUser(user));
  return button;
}

function renderSidebar() {
  const conversationIds = new Set(
    state.conversations.map((item) => item.otherUser.id)
  );
  const availableOnline = state.onlineUsers.filter(
    (user) =>
      user.id !== state.currentUser?.id && !conversationIds.has(user.id)
  );

  elements.conversationList?.replaceChildren(
    ...state.conversations.map(createConversationItem)
  );
  elements.userList?.replaceChildren(
    ...availableOnline.map(createOnlineUserItem)
  );

  const totalVisible = state.conversations.length + availableOnline.length;
  elements.onlineCount.textContent = String(state.onlineUsers.length);
  elements.emptyUsers?.classList.toggle("is-hidden", totalVisible > 0);
}

function selectConversation(conversation) {
  state.selectedConversationId = conversation.conversationId;
  state.selectedUser = conversation.otherUser;
  state.unread.delete(conversation.otherUser.id);
  clearSelectedFile();
  elements.emptyState.classList.add("is-hidden");
  elements.chatPanel.classList.remove("is-hidden");
  elements.typingStatus.classList.add("is-hidden");
  const isOnline = state.onlineUsers.some(
    (user) => user.id === conversation.otherUser.id
  );
  renderConversationHeader(conversation.otherUser, isOnline);
  clearMessages();
  renderSidebar();
  closeSidebar();
  loadMessages({ reset: true });
}

function startChatWithOnlineUser(user) {
  const existing = state.conversations.find(
    (item) => item.otherUser.id === user.id
  );
  if (existing) {
    selectConversation(existing);
    return;
  }

  state.selectedConversationId = null;
  state.selectedUser = user;
  clearSelectedFile();
  elements.emptyState.classList.add("is-hidden");
  elements.chatPanel.classList.remove("is-hidden");
  renderConversationHeader(user, true);
  clearMessages();
  renderSidebar();
  closeSidebar();
  elements.messageInput.focus();
}

function loadMessages({ reset = false } = {}) {
  if (!state.selectedConversationId) return;

  socket.emit(
    "load_messages",
    {
      conversationId: state.selectedConversationId,
      limit: 30,
      cursor: reset ? null : state.nextCursor
    },
    (response) => {
      if (!response?.ok) {
        appendSystemMessage(response?.error || "Không thể tải tin nhắn.");
        return;
      }

      if (reset) clearMessages();
      response.messages.forEach(appendMessage);
      state.nextCursor = response.nextCursor;
      if (response.otherUser) {
        state.selectedUser = response.otherUser;
      }
      const lastMessage = response.messages.at(-1);
      if (lastMessage) {
        socket.emit("mark_read", {
          conversationId: state.selectedConversationId,
          messageId: lastMessage.id
        });
      }
      if (reset) elements.messageInput.focus();
    }
  );
}

function loadConversations() {
  socket.emit("load_conversations", {}, (response) => {
    if (!response?.ok) {
      showToast(response?.error || "Không thể tải hội thoại.", "error");
      return;
    }
    state.conversations = response.conversations || [];
    renderSidebar();
  });
}

function joinChat() {
  socket.emit("join_chat", {}, (response) => {
    if (!response?.ok) {
      showToast(response?.error || "Không thể tham gia phòng chat.", "error");
      return;
    }
    state.currentUser = response.user;
    state.hasJoined = true;
    elements.currentUsername.textContent =
      response.user.displayName || response.user.username;
    setAvatar(
      elements.currentAvatar,
      response.user.displayName || response.user.username
    );
    setConnectionVisible(false);
    loadConversations();
  });
}

function emitPrivateMessage(payload) {
  return new Promise((resolve) => {
    socket.emit("private_message", payload, resolve);
  });
}

async function uploadSelectedFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/uploads", {
    method: "POST",
    credentials: "include",
    body: formData
  });
  const result = await response.json();
  if (!response.ok || !result?.ok) {
    throw new Error(result?.error || "Không thể upload file.");
  }
  return result.file;
}

async function sendFileMessage(fileMeta) {
  const response = await emitPrivateMessage({
    receiverId: state.selectedUser.id,
    conversationId: state.selectedConversationId,
    type: fileMeta.kind,
    fileUrl: fileMeta.fileUrl,
    fileKey: fileMeta.fileKey,
    fileName: fileMeta.fileName,
    mimeType: fileMeta.mimeType,
    size: fileMeta.size
  });
  if (!response?.ok) throw new Error(response?.error || "Không thể gửi file.");
  if (response.message?.conversationId) {
    state.selectedConversationId = response.message.conversationId;
    loadConversations();
  }
}

async function sendTextMessage(text) {
  const response = await emitPrivateMessage({
    receiverId: state.selectedUser.id,
    conversationId: state.selectedConversationId,
    type: "text",
    message: text
  });
  if (!response?.ok) throw new Error(response?.error || "Không thể gửi tin nhắn.");
  if (response.message?.conversationId) {
    state.selectedConversationId = response.message.conversationId;
    loadConversations();
  }
}

async function handleMessageSubmit() {
  if (!state.selectedUser) {
    showToast("Vui lòng chọn người để chat.", "error");
    return;
  }

  const text = elements.messageInput.value.trim();
  const file = state.selectedFile;
  if (!file && !text) return;

  if (state.isTyping && state.selectedConversationId) {
    state.isTyping = false;
    socket.emit("stop_typing", {
      conversationId: state.selectedConversationId,
      receiverId: state.selectedUser.id
    });
  }

  state.isUploading = Boolean(file);
  setComposerDisabled(true);
  const isOnline = state.onlineUsers.some(
    (user) => user.id === state.selectedUser.id
  );
  renderConversationHeader(state.selectedUser, isOnline);

  try {
    if (file) {
      const fileMeta = await uploadSelectedFile(file);
      await sendFileMessage(fileMeta);
      clearSelectedFile();
    }
    if (text) {
      await sendTextMessage(text);
      elements.messageInput.value = "";
    }
    elements.messageInput.focus();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    state.isUploading = false;
    renderConversationHeader(
      state.selectedUser,
      state.onlineUsers.some((user) => user.id === state.selectedUser.id)
    );
    setComposerDisabled(false);
  }
}

function switchAuthTab(tab) {
  const isLogin = tab === "login";
  elements.loginTab?.classList.toggle("is-active", isLogin);
  elements.registerTab?.classList.toggle("is-active", !isLogin);
  elements.loginTab?.setAttribute("aria-selected", String(isLogin));
  elements.registerTab?.setAttribute("aria-selected", String(!isLogin));
  elements.loginForm?.classList.toggle("is-hidden", !isLogin);
  elements.registerForm?.classList.toggle("is-hidden", isLogin);
}

if (page === "home") {
  const params = new URLSearchParams(window.location.search);
  if (params.get("auth") === "register") switchAuthTab("register");
  else switchAuthTab("login");

  api("/api/auth/me")
    .then(() => {
      window.location.href = "/chat";
    })
    .catch(() => {});

  elements.loginTab?.addEventListener("click", () => switchAuthTab("login"));
  elements.registerTab?.addEventListener("click", () => switchAuthTab("register"));

  elements.loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    elements.loginError.textContent = "";
    const formData = new FormData(elements.loginForm);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          usernameOrEmail: formData.get("usernameOrEmail"),
          password: formData.get("password")
        })
      });
      window.location.href = "/chat";
    } catch (error) {
      elements.loginError.textContent = error.message;
    }
  });

  elements.registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    elements.registerError.textContent = "";
    const formData = new FormData(elements.registerForm);
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: formData.get("username"),
          email: formData.get("email"),
          password: formData.get("password"),
          confirmPassword: formData.get("confirmPassword")
        })
      });
      window.location.href = "/chat";
    } catch (error) {
      elements.registerError.textContent = error.message;
    }
  });
}

if (page === "chat") {
  api("/api/auth/me")
    .then((data) => {
      state.currentUser = data.user;
      elements.currentUsername.textContent =
        data.user.displayName || data.user.username;
      setAvatar(
        elements.currentAvatar,
        data.user.displayName || data.user.username
      );
      if (socket.connected) joinChat();
    })
    .catch(() => {
      window.location.replace("/?auth=login");
    });

  socket.on("connect", () => {
    if (state.currentUser && !state.hasJoined) joinChat();
  });

  elements.messageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleMessageSubmit();
  });

  elements.attachButton?.addEventListener("click", () => {
    elements.fileInput?.click();
  });

  elements.fileInput?.addEventListener("change", () => {
    const file = elements.fileInput.files?.[0];
    if (!file) {
      clearSelectedFile();
      return;
    }
    if (!isAllowedFile(file)) {
      showToast("File không hợp lệ hoặc vượt quá 6MB.", "error");
      clearSelectedFile();
      return;
    }
    state.selectedFile = file;
    renderSelectedFilePreview(file);
  });

  elements.removeFileButton?.addEventListener("click", clearSelectedFile);

  elements.messageInput.addEventListener("input", () => {
    if (!state.selectedUser || !state.selectedConversationId) return;
    if (!state.isTyping && elements.messageInput.value.trim()) {
      state.isTyping = true;
      socket.emit("typing", {
        conversationId: state.selectedConversationId,
        receiverId: state.selectedUser.id
      });
    }
    window.clearTimeout(state.typingTimer);
    state.typingTimer = window.setTimeout(() => {
      if (state.isTyping && state.selectedUser && state.selectedConversationId) {
        state.isTyping = false;
        socket.emit("stop_typing", {
          conversationId: state.selectedConversationId,
          receiverId: state.selectedUser.id
        });
      }
    }, 1200);
  });

  elements.logoutButton.addEventListener("click", async () => {
    state.isLoggingOut = true;
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch (error) {
      // ignore
    }
    socket.disconnect();
    window.location.href = "/";
  });

  elements.mobileMenuButton.addEventListener("click", () => {
    elements.sidebar.classList.add("is-open");
    elements.sidebarBackdrop.classList.remove("is-hidden");
  });
  elements.sidebarBackdrop.addEventListener("click", closeSidebar);

  socket.on("online_users", (users) => {
    state.onlineUsers = Array.isArray(users) ? users : [];
    renderSidebar();
    if (state.selectedUser) {
      renderConversationHeader(
        state.selectedUser,
        state.onlineUsers.some((user) => user.id === state.selectedUser.id)
      );
    }
  });

  socket.on("private_message", (message) => {
    const belongsToSelected =
      state.selectedConversationId &&
      message.conversationId === state.selectedConversationId;

    if (belongsToSelected) {
      appendMessage(message);
      socket.emit("mark_read", {
        conversationId: message.conversationId,
        messageId: message.id
      });
      return;
    }

    if (message.senderId !== state.currentUser?.id) {
      state.unread.set(
        message.senderId,
        (state.unread.get(message.senderId) || 0) + 1
      );
      loadConversations();
      const preview =
        message.type === "image"
          ? "một ảnh"
          : message.type === "file"
            ? "một file"
            : "một tin nhắn";
      showToast(`${message.senderName} vừa gửi cho bạn ${preview}.`);
    } else {
      loadConversations();
    }
  });

  socket.on("typing", ({ conversationId, senderId, senderName }) => {
    if (state.selectedConversationId !== conversationId) return;
    elements.typingText.textContent = `${senderName} đang nhập`;
    elements.typingStatus.classList.remove("is-hidden");
    window.clearTimeout(state.typingSenderTimer);
    state.typingSenderTimer = window.setTimeout(() => {
      elements.typingStatus.classList.add("is-hidden");
    }, 2500);
  });

  socket.on("stop_typing", ({ conversationId }) => {
    if (state.selectedConversationId === conversationId) {
      elements.typingStatus.classList.add("is-hidden");
    }
  });

  socket.on("user_offline", (user) => {
    if (state.selectedUser?.id === user.id) {
      renderConversationHeader(state.selectedUser, false);
    }
    renderSidebar();
  });

  socket.on("disconnect", () => {
    state.hasJoined = false;
    if (!state.isLoggingOut) setConnectionVisible(true);
  });
  socket.on("connect_error", () => {
    if (!state.isLoggingOut) setConnectionVisible(true);
  });
}