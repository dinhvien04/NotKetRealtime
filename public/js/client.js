const page = document.body.dataset.page;
const USER_KEY = "noiKetUsername";
const CLIENT_ID_KEY = "noiKetClientId";
const socket = page === "chat" ? io() : null;

const elements = {
  joinForm: document.getElementById("joinForm"),
  usernameInput: document.getElementById("usernameInput"),
  joinButton: document.getElementById("joinButton"),
  joinError: document.getElementById("joinError"),
  currentUsername: document.getElementById("currentUsername"),
  currentAvatar: document.getElementById("currentAvatar"),
  onlineCount: document.getElementById("onlineCount"),
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
  onlineUsers: [],
  unread: new Map(),
  hasJoined: false,
  isLoggingOut: false,
  isTyping: false,
  typingTimer: null,
  typingSenderTimer: null
};

function getClientId() {
  let clientId = sessionStorage.getItem(CLIENT_ID_KEY);
  if (!clientId) {
    clientId =
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem(CLIENT_ID_KEY, clientId);
  }
  return clientId;
}

function getInitials(username = "") {
  return username
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part.charAt(0).toLocaleUpperCase("vi"))
    .join("");
}

function setAvatar(element, username) {
  if (element) {
    element.textContent = getInitials(username);
  }
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

function appendMessage(message) {
  const isOwn = message.senderId === state.currentUser?.id;
  const row = document.createElement("article");
  const bubble = document.createElement("div");
  const meta = document.createElement("span");

  row.className = `message-row${isOwn ? " is-own" : ""}`;
  bubble.className = "message-bubble";
  bubble.textContent = message.message;
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

function renderConversationHeader(user, isOnline) {
  elements.selectedUsername.textContent = user.username;
  setAvatar(elements.selectedAvatar, user.username);
  elements.selectedStatus.classList.toggle("is-offline", !isOnline);
  elements.selectedStatus.lastChild.textContent = isOnline
    ? "Đang trực tuyến"
    : "Đã ngoại tuyến";
  elements.chatPanel.classList.toggle("is-offline", !isOnline);
  elements.messageInput.disabled = !isOnline;
  elements.sendButton.disabled = !isOnline;
  elements.messageInput.placeholder = isOnline
    ? "Nhập tin nhắn..."
    : "Không thể gửi tin nhắn khi người nhận offline";
  elements.inputHint.textContent = isOnline
    ? "Nhấn Enter để gửi tin nhắn."
    : "Người dùng này đã rời khỏi cuộc trò chuyện.";
}

function createUserItem(user) {
  const button = document.createElement("button");
  const avatar = document.createElement("span");
  const copy = document.createElement("span");
  const name = document.createElement("strong");
  const status = document.createElement("span");
  const unreadCount = state.unread.get(user.id) || 0;

  button.type = "button";
  button.className = "user-item";
  if (state.selectedUser?.id === user.id) {
    button.classList.add("is-active");
  }

  avatar.className = "avatar";
  setAvatar(avatar, user.username);
  copy.className = "user-copy";
  name.textContent = user.username;
  status.textContent = "Đang online";
  copy.append(name, status);
  button.append(avatar, copy);

  if (unreadCount > 0) {
    const badge = document.createElement("span");
    badge.className = "unread-badge";
    badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
    button.append(badge);
  }

  button.addEventListener("click", () => selectUser(user));
  return button;
}

function renderOnlineUsers() {
  const users = state.onlineUsers.filter(
    (user) => user.id !== state.currentUser?.id
  );
  elements.onlineCount.textContent = String(users.length);
  elements.userList.replaceChildren(...users.map(createUserItem));
  elements.emptyUsers.classList.toggle("is-hidden", users.length > 0);
}

function selectUser(user) {
  state.selectedUser = user;
  state.unread.delete(user.id);
  elements.emptyState.classList.add("is-hidden");
  elements.chatPanel.classList.remove("is-hidden");
  elements.typingStatus.classList.add("is-hidden");
  renderConversationHeader(user, true);
  clearMessages();
  renderOnlineUsers();
  closeSidebar();

  socket.emit("load_messages", user.id, (response) => {
    if (state.selectedUser?.id !== user.id) return;
    if (!response?.ok) {
      renderConversationHeader(user, false);
      appendSystemMessage(
        response?.error || "Không thể tải cuộc trò chuyện này."
      );
      return;
    }
    response.messages.forEach(appendMessage);
    elements.messageInput.focus();
  });
}

function joinChat() {
  const username = sessionStorage.getItem(USER_KEY);
  if (!username) {
    window.location.replace("/");
    return;
  }

  socket.emit(
    "join_user",
    { username, userId: getClientId() },
    (response) => {
      if (!response?.ok) {
        showToast(response?.error || "Không thể tham gia phòng chat.", "error");
        return;
      }

      state.currentUser = response.user;
      state.hasJoined = true;
      sessionStorage.setItem(USER_KEY, response.user.username);
      elements.currentUsername.textContent = response.user.username;
      setAvatar(elements.currentAvatar, response.user.username);
      setConnectionVisible(false);
    }
  );
}

if (page === "home") {
  elements.joinForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = elements.usernameInput.value.trim();
    elements.joinError.textContent = "";

    if (!username) {
      elements.joinError.textContent = "Vui lòng nhập tên người dùng";
      elements.usernameInput.focus();
      return;
    }

    sessionStorage.setItem(USER_KEY, username);
    sessionStorage.removeItem(CLIENT_ID_KEY);
    window.location.href = "/chat";
  });
}

if (page === "chat") {
  if (socket.connected) joinChat();
  socket.on("connect", () => {
    if (!state.hasJoined) joinChat();
  });

  elements.messageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = elements.messageInput.value.trim();
    if (!state.selectedUser) {
      showToast("Vui lòng chọn người để chat.", "error");
      return;
    }
    if (!message) return;

    if (state.isTyping) {
      state.isTyping = false;
      socket.emit("stop_typing", state.selectedUser.id);
    }

    elements.sendButton.disabled = true;
    socket.emit(
      "private_message",
      { receiverId: state.selectedUser.id, message },
      (response) => {
        elements.sendButton.disabled = elements.messageInput.disabled;
        if (!response?.ok) {
          showToast(response?.error || "Không thể gửi tin nhắn.", "error");
          if (response?.error?.includes("ngoại tuyến")) {
            renderConversationHeader(state.selectedUser, false);
          }
          return;
        }
        elements.messageInput.value = "";
        elements.messageInput.focus();
      }
    );
  });

  elements.messageInput.addEventListener("input", () => {
    if (!state.selectedUser || elements.messageInput.disabled) return;
    if (!state.isTyping && elements.messageInput.value.trim()) {
      state.isTyping = true;
      socket.emit("typing", state.selectedUser.id);
    }
    window.clearTimeout(state.typingTimer);
    state.typingTimer = window.setTimeout(() => {
      if (state.isTyping && state.selectedUser) {
        state.isTyping = false;
        socket.emit("stop_typing", state.selectedUser.id);
      }
    }, 1200);
  });

  elements.messageInput.addEventListener("blur", () => {
    if (state.isTyping && state.selectedUser) {
      state.isTyping = false;
      socket.emit("stop_typing", state.selectedUser.id);
    }
  });

  elements.logoutButton.addEventListener("click", () => {
    state.isLoggingOut = true;
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(CLIENT_ID_KEY);
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
    renderOnlineUsers();
  });

  socket.on("private_message", (message) => {
    const belongsToSelected =
      state.selectedUser &&
      ((message.senderId === state.currentUser?.id &&
        message.receiverId === state.selectedUser.id) ||
        (message.senderId === state.selectedUser.id &&
          message.receiverId === state.currentUser?.id));

    if (belongsToSelected) {
      appendMessage(message);
      return;
    }

    if (message.senderId !== state.currentUser?.id) {
      state.unread.set(
        message.senderId,
        (state.unread.get(message.senderId) || 0) + 1
      );
      renderOnlineUsers();
      showToast(`${message.senderName} vừa gửi cho bạn một tin nhắn.`);
    }
  });

  socket.on("typing", ({ senderId, senderName }) => {
    if (state.selectedUser?.id !== senderId) return;
    elements.typingText.textContent = `${senderName} đang nhập`;
    elements.typingStatus.classList.remove("is-hidden");
    window.clearTimeout(state.typingSenderTimer);
    state.typingSenderTimer = window.setTimeout(() => {
      elements.typingStatus.classList.add("is-hidden");
    }, 2500);
  });

  socket.on("stop_typing", ({ senderId }) => {
    if (state.selectedUser?.id === senderId) {
      elements.typingStatus.classList.add("is-hidden");
    }
  });

  socket.on("user_offline", (user) => {
    state.unread.delete(user.id);
    if (state.selectedUser?.id === user.id) {
      renderConversationHeader(state.selectedUser, false);
      elements.typingStatus.classList.add("is-hidden");
      appendSystemMessage("Người dùng này đã rời khỏi cuộc trò chuyện.");
    }
    renderOnlineUsers();
  });

  socket.on("disconnect", () => {
    state.hasJoined = false;
    if (!state.isLoggingOut) setConnectionVisible(true);
  });
  socket.on("connect_error", () => setConnectionVisible(true));
}
