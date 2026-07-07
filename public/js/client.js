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
const ALLOWED_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "👏"];
const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_VOICE_SECONDS = 120;
const DELETED_LABEL = "Tin nhắn đã bị xóa";
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
  recordButton: document.getElementById("recordButton"),
  recordingStatus: document.getElementById("recordingStatus"),
  recordingTimer: document.getElementById("recordingTimer"),
  cancelRecordingButton: document.getElementById("cancelRecordingButton"),
  sendRecordingButton: document.getElementById("sendRecordingButton"),
  uploadProgress: document.getElementById("uploadProgress"),
  uploadProgressBar: document.getElementById("uploadProgressBar"),
  fileInput: document.getElementById("fileInput"),
  selectedFilePreview: document.getElementById("selectedFilePreview"),
  selectedFileName: document.getElementById("selectedFileName"),
  selectedFileSize: document.getElementById("selectedFileSize"),
  removeFileButton: document.getElementById("removeFileButton"),
  inputHint: document.getElementById("inputHint"),
  connectionOverlay: document.getElementById("connectionOverlay"),
  toastRegion: document.getElementById("toastRegion"),
  logoutButton: document.getElementById("logoutButton"),
  profileButton: document.getElementById("profileButton"),
  profileModal: document.getElementById("profileModal"),
  profileCloseButton: document.getElementById("profileCloseButton"),
  profileForm: document.getElementById("profileForm"),
  profileDisplayName: document.getElementById("profileDisplayName"),
  profileBio: document.getElementById("profileBio"),
  profileEmail: document.getElementById("profileEmail"),
  profileAvatarFile: document.getElementById("profileAvatarFile"),
  profileOldPassword: document.getElementById("profileOldPassword"),
  profileNewPassword: document.getElementById("profileNewPassword"),
  profileConfirmPassword: document.getElementById("profileConfirmPassword"),
  profileError: document.getElementById("profileError"),
  forgotTab: document.getElementById("forgotTab"),
  forgotForm: document.getElementById("forgotForm"),
  forgotError: document.getElementById("forgotError"),
  forgotHint: document.getElementById("forgotHint"),
  forgotSubmitButton: document.getElementById("forgotSubmitButton"),
  openForgotFromLogin: document.getElementById("openForgotFromLogin"),
  mobileMenuButton: document.getElementById("mobileMenuButton"),
  sidebar: document.getElementById("sidebar"),
  sidebarBackdrop: document.getElementById("sidebarBackdrop"),
  messageSearchInput: document.getElementById("messageSearchInput"),
  messageSearchButton: document.getElementById("messageSearchButton"),
  searchResults: document.getElementById("searchResults"),
  replyPreview: document.getElementById("replyPreview"),
  replyPreviewText: document.getElementById("replyPreviewText"),
  cancelReplyButton: document.getElementById("cancelReplyButton"),
  tabDirect: document.getElementById("tabDirect"),
  tabOnline: document.getElementById("tabOnline"),
  tabPublic: document.getElementById("tabPublic"),
  tabGroups: document.getElementById("tabGroups"),
  panelDirect: document.getElementById("panelDirect"),
  panelOnline: document.getElementById("panelOnline"),
  panelPublic: document.getElementById("panelPublic"),
  panelGroups: document.getElementById("panelGroups"),
  publicRoomList: document.getElementById("publicRoomList"),
  groupList: document.getElementById("groupList"),
  createGroupButton: document.getElementById("createGroupButton"),
  groupModal: document.getElementById("groupModal"),
  groupCloseButton: document.getElementById("groupCloseButton"),
  groupForm: document.getElementById("groupForm"),
  groupNameInput: document.getElementById("groupNameInput"),
  groupMembersInput: document.getElementById("groupMembersInput"),
  groupError: document.getElementById("groupError"),
  conversationTypeChip: document.getElementById("conversationTypeChip")
};

const state = {
  csrfToken: null,
  currentUser: null,
  selectedUser: null,
  selectedConversationId: null,
  chatMode: "direct",
  publicRoom: null,
  activeConversation: null,
  groups: [],
  sidebarTab: "direct",
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
  isLoadingOlder: false,
  hasMoreMessages: false,
  loadedMessageIds: new Set(),
  messageRows: new Map(),
  replyTo: null,
  recording: null,
  forgotResetTokenId: null,
  forgotStep: "request"
};

async function ensureCsrfToken() {
  if (state.csrfToken) {
    return state.csrfToken;
  }

  const response = await fetch("/api/csrf-token", { credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok || !data.csrfToken) {
    throw new Error(data.error || "Không thể lấy CSRF token.");
  }

  state.csrfToken = data.csrfToken;
  return state.csrfToken;
}

async function api(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = {
    ...(options.headers || {})
  };

  if (method !== "GET" && method !== "HEAD") {
    const csrfToken = await ensureCsrfToken();
    headers["X-CSRF-Token"] = csrfToken;
  }

  if (!headers["Content-Type"] && options.body && typeof options.body === "string") {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, {
    credentials: "include",
    headers,
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

function setAvatar(element, name, avatarUrl) {
  if (!element) return;
  if (avatarUrl) {
    element.textContent = "";
    element.style.backgroundImage = `url("${avatarUrl}")`;
    element.style.backgroundSize = "cover";
    element.style.backgroundPosition = "center";
    return;
  }
  element.style.backgroundImage = "";
  element.textContent = getInitials(name);
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
  state.loadedMessageIds.clear();
  state.messageRows.clear();
  elements.messages.replaceChildren(createDaySeparator());
}

function getMessageBody(message) {
  return message.message || message.body || message.text || "";
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(Number(ms) / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getMessagePreview(message) {
  if (message.isDeleted) return DELETED_LABEL;
  if (message.type === "image") return "Ảnh";
  if (message.type === "voice") return "Tin thoại";
  if (message.type === "file") return message.fileName || "File";
  const body = getMessageBody(message);
  return body.length > 80 ? `${body.slice(0, 80)}…` : body;
}

function canEditOwnMessage(message) {
  if (!message || message.isDeleted || message.type !== "text") return false;
  if (message.senderId !== state.currentUser?.id) return false;
  const createdAt = new Date(message.createdAt).getTime();
  return Date.now() - createdAt <= MESSAGE_EDIT_WINDOW_MS;
}

function canDeleteOwnMessage(message) {
  if (!message || message.isDeleted) return false;
  return message.senderId === state.currentUser?.id;
}

function setReplyTarget(message) {
  state.replyTo = {
    id: message.id,
    preview: getMessagePreview(message),
    senderName: message.senderName
  };
  if (elements.replyPreviewText) {
    elements.replyPreviewText.textContent = `Trả lời ${message.senderName}: ${state.replyTo.preview}`;
  }
  elements.replyPreview?.classList.remove("is-hidden");
  elements.messageInput?.focus();
}

function clearReplyTarget() {
  state.replyTo = null;
  elements.replyPreview?.classList.add("is-hidden");
}

function hideSearchResults() {
  elements.searchResults?.classList.add("is-hidden");
  elements.searchResults?.replaceChildren();
}

function renderReactionChips(container, message) {
  container.replaceChildren();
  const reactions = Array.isArray(message.reactions) ? message.reactions : [];
  if (!reactions.length) {
    container.classList.add("is-hidden");
    return;
  }
  container.classList.remove("is-hidden");
  const grouped = new Map();
  for (const reaction of reactions) {
    const key = reaction.emoji;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(reaction);
  }
  for (const [emoji, items] of grouped) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "message-reaction-chip";
    const reacted = items.some((item) => item.userId === state.currentUser?.id);
    if (reacted) chip.classList.add("is-own");
    chip.textContent = `${emoji} ${items.length}`;
    chip.title = items
      .map((item) => item.displayName || item.username || "User")
      .join(", ");
    chip.addEventListener("click", () => toggleReaction(message.id, emoji, reacted));
    container.append(chip);
  }
}

function createMessageActions(message) {
  const actions = document.createElement("div");
  actions.className = "message-actions";
  if (message.isDeleted) return actions;

  const replyBtn = document.createElement("button");
  replyBtn.type = "button";
  replyBtn.className = "message-action-btn";
  replyBtn.textContent = "Trả lời";
  replyBtn.addEventListener("click", () => setReplyTarget(message));
  actions.append(replyBtn);

  const reactBtn = document.createElement("button");
  reactBtn.type = "button";
  reactBtn.className = "message-action-btn";
  reactBtn.textContent = "React";
  reactBtn.addEventListener("click", () => openReactionPicker(message.id));
  actions.append(reactBtn);

  if (canEditOwnMessage(message)) {
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "message-action-btn";
    editBtn.textContent = "Sửa";
    editBtn.addEventListener("click", () => editMessage(message));
    actions.append(editBtn);
  }

  if (canDeleteOwnMessage(message)) {
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "message-action-btn";
    deleteBtn.textContent = "Xóa";
    deleteBtn.addEventListener("click", () => deleteMessage(message.id));
    actions.append(deleteBtn);
  }

  return actions;
}

function fillMessageBubble(bubble, message) {
  bubble.replaceChildren();
  const messageType = message.type || "text";
  bubble.className = `message-bubble${messageType === "image" ? " message-bubble-image" : ""}${messageType === "file" ? " message-bubble-file" : ""}${messageType === "voice" ? " message-bubble-voice" : ""}`;

  if (message.isDeleted) {
    bubble.classList.add("is-deleted");
    bubble.textContent = DELETED_LABEL;
    return;
  }

  if (message.replyToMessageId) {
    const quote = document.createElement("div");
    quote.className = "message-reply-quote";
    quote.textContent = "Trả lời tin nhắn";
    bubble.append(quote);
  }

  if (messageType === "image") bubble.append(createImageBubble(message));
  else if (messageType === "file") bubble.append(createFileBubble(message));
  else if (messageType === "voice") bubble.append(createVoiceBubble(message));
  else bubble.append(document.createTextNode(getMessageBody(message)));

  if (message.isEdited) {
    const edited = document.createElement("span");
    edited.className = "message-edited-tag";
    edited.textContent = " • đã chỉnh sửa";
    bubble.append(edited);
  }
}

function createMessageRow(message) {
  const isOwn = message.senderId === state.currentUser?.id;
  const row = document.createElement("article");
  const bubble = document.createElement("div");
  const reactions = document.createElement("div");
  const meta = document.createElement("span");
  row.className = `message-row${isOwn ? " is-own" : ""}`;
  row.dataset.messageId = message.id;
  fillMessageBubble(bubble, message);
  reactions.className = "message-reactions is-hidden";
  renderReactionChips(reactions, message);
  meta.className = "message-meta";
  meta.textContent = isOwn
    ? `${message.time} • Đã gửi`
    : `${message.senderName} • ${message.time}`;
  row.append(bubble, reactions, createMessageActions(message), meta);
  return row;
}

function updateMessageRow(message) {
  const row = state.messageRows.get(message.id);
  if (!row) return;
  const bubble = row.querySelector(".message-bubble");
  const reactions = row.querySelector(".message-reactions");
  const actions = row.querySelector(".message-actions");
  if (bubble) fillMessageBubble(bubble, message);
  if (reactions) renderReactionChips(reactions, message);
  if (actions) actions.replaceWith(createMessageActions(message));
}

function openReactionPicker(messageId) {
  const picker = document.createElement("div");
  picker.className = "reaction-picker";
  for (const emoji of ALLOWED_REACTIONS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "reaction-btn";
    btn.textContent = emoji;
    btn.addEventListener("click", () => {
      addReaction(messageId, emoji);
      picker.remove();
    });
    picker.append(btn);
  }
  const row = state.messageRows.get(messageId);
  if (row) {
    row.append(picker);
    window.setTimeout(() => picker.remove(), 4000);
  }
}

function emitSocketAck(eventName, payload) {
  return new Promise((resolve) => {
    socket.emit(eventName, payload, resolve);
  });
}

async function editMessage(message) {
  const nextText = window.prompt("Chỉnh sửa tin nhắn:", getMessageBody(message));
  if (nextText === null) return;
  const trimmed = nextText.trim();
  if (!trimmed) {
    showToast("Nội dung không hợp lệ.", "error");
    return;
  }
  const response = await emitSocketAck("edit_message", {
    messageId: message.id,
    body: trimmed
  });
  if (!response?.ok) {
    showToast(response?.error || "Không thể chỉnh sửa.", "error");
    return;
  }
  if (response.message) updateMessageRow(response.message);
}

async function deleteMessage(messageId) {
  if (!window.confirm("Xóa tin nhắn này?")) return;
  const response = await emitSocketAck("delete_message", { messageId });
  if (!response?.ok) {
    showToast(response?.error || "Không thể xóa.", "error");
    return;
  }
  if (response.message) updateMessageRow(response.message);
}

async function addReaction(messageId, emoji) {
  const response = await emitSocketAck("add_reaction", { messageId, emoji });
  if (!response?.ok) {
    showToast(response?.error || "Không thể thêm reaction.", "error");
  }
}

async function toggleReaction(messageId, emoji, hasReacted) {
  const eventName = hasReacted ? "remove_reaction" : "add_reaction";
  const response = await emitSocketAck(eventName, { messageId, emoji });
  if (!response?.ok) {
    showToast(response?.error || "Không thể cập nhật reaction.", "error");
  }
}

async function runMessageSearch() {
  if (!state.selectedConversationId) return;
  const queryText = elements.messageSearchInput?.value.trim() || "";
  if (!queryText) {
    hideSearchResults();
    return;
  }
  try {
    const params = new URLSearchParams({
      conversationId: state.selectedConversationId,
      q: queryText,
      limit: "20"
    });
    const result = await api(`/api/messages/search?${params.toString()}`);
    renderSearchResults(result.messages || []);
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderSearchResults(messages) {
  if (!elements.searchResults) return;
  elements.searchResults.replaceChildren();
  if (!messages.length) {
    const empty = document.createElement("p");
    empty.textContent = "Không tìm thấy tin nhắn.";
    elements.searchResults.append(empty);
    elements.searchResults.classList.remove("is-hidden");
    return;
  }
  for (const message of messages) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-result-item";
    button.textContent = `${message.senderName}: ${getMessagePreview(message)}`;
    button.addEventListener("click", () => {
      hideSearchResults();
      const row = state.messageRows.get(message.id);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.classList.add("is-highlighted");
        window.setTimeout(() => row.classList.remove("is-highlighted"), 2000);
      }
    });
    elements.searchResults.append(button);
  }
  elements.searchResults.classList.remove("is-hidden");
}

function trackMessageRow(message, row, { prepend = false } = {}) {
  if (state.loadedMessageIds.has(message.id)) return false;
  state.loadedMessageIds.add(message.id);
  state.messageRows.set(message.id, row);
  if (prepend) elements.messages.prepend(row);
  else elements.messages.append(row);
  return true;
}

function appendMessage(message) {
  if (state.loadedMessageIds.has(message.id)) {
    updateMessageRow(message);
    return;
  }
  const row = createMessageRow(message);
  trackMessageRow(message, row);
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function prependMessages(messages) {
  const previousHeight = elements.messages.scrollHeight;
  let added = 0;
  for (const message of messages) {
    if (state.loadedMessageIds.has(message.id)) continue;
    const row = createMessageRow(message);
    state.loadedMessageIds.add(message.id);
    state.messageRows.set(message.id, row);
    const firstMessage = elements.messages.querySelector(".message-row");
    if (firstMessage) elements.messages.insertBefore(row, firstMessage);
    else elements.messages.append(row);
    added += 1;
  }
  if (added > 0) {
    const delta = elements.messages.scrollHeight - previousHeight;
    elements.messages.scrollTop += delta;
  }
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

function createVoiceBubble(message) {
  const wrapper = document.createElement("div");
  const audio = document.createElement("audio");
  const meta = document.createElement("span");
  audio.controls = true;
  audio.preload = "none";
  audio.src = message.fileUrl;
  meta.className = "message-voice-meta";
  meta.textContent = message.durationMs
    ? `Tin thoại • ${formatDuration(message.durationMs)}`
    : "Tin thoại";
  wrapper.append(audio, meta);
  return wrapper;
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
  const blocked = disabled || isOffline || Boolean(state.recording);
  elements.sendButton.disabled = blocked;
  if (elements.attachButton) elements.attachButton.disabled = blocked;
  if (elements.recordButton) {
    elements.recordButton.disabled =
      isOffline || disabled || state.isUploading || Boolean(state.selectedFile);
  }
}

function setUploadProgress(percent) {
  if (!elements.uploadProgress || !elements.uploadProgressBar) return;
  if (percent === null) {
    elements.uploadProgress.classList.add("is-hidden");
    elements.uploadProgressBar.style.width = "0%";
    return;
  }
  elements.uploadProgress.classList.remove("is-hidden");
  elements.uploadProgressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
}

function renderConversationHeader(user = state.selectedUser, isOnline = true) {
  if (state.chatMode === "public" && state.publicRoom) {
    elements.selectedUsername.textContent = state.publicRoom.name || "Phòng trò chuyện";
    setAvatar(elements.selectedAvatar, "P");
    elements.selectedStatus.classList.remove("is-offline");
    elements.selectedStatus.lastChild.textContent = "Phòng công khai";
    elements.conversationTypeChip.textContent = "Phòng chung";
    elements.chatPanel.classList.remove("is-offline");
  } else if (state.chatMode === "group" && state.activeConversation) {
    elements.selectedUsername.textContent =
      state.activeConversation.name || "Nhóm chat";
    setAvatar(elements.selectedAvatar, state.activeConversation.name || "G");
    elements.selectedStatus.classList.remove("is-offline");
    elements.selectedStatus.lastChild.textContent = "Nhóm chat";
    elements.conversationTypeChip.textContent = "Nhóm";
    elements.chatPanel.classList.remove("is-offline");
  } else if (user) {
    const displayName = user.displayName || user.username;
    elements.selectedUsername.textContent = displayName;
    setAvatar(elements.selectedAvatar, displayName);
    elements.selectedStatus.classList.toggle("is-offline", !isOnline);
    elements.selectedStatus.lastChild.textContent = isOnline
      ? "Đang trực tuyến"
      : "Đã ngoại tuyến";
    elements.conversationTypeChip.textContent = "Cuộc trò chuyện riêng";
    elements.chatPanel.classList.toggle("is-offline", !isOnline);
  }

  elements.messageInput.disabled = state.isUploading || Boolean(state.recording);
  elements.attachButton.disabled = state.isUploading || Boolean(state.recording);
  elements.recordButton.disabled =
    state.isUploading || Boolean(state.recording) || Boolean(state.selectedFile);
  elements.sendButton.disabled = state.isUploading || Boolean(state.recording);
  elements.messageInput.placeholder = "Nhập tin nhắn...";

  if (state.isUploading) {
    elements.inputHint.textContent = "Đang tải file lên...";
  } else if (state.chatMode === "public") {
    elements.inputHint.textContent = "Tin nhắn sẽ hiển thị cho mọi người trong phòng chung.";
  } else if (state.chatMode === "group") {
    elements.inputHint.textContent = "Nhấn Enter để gửi tin nhắn trong nhóm.";
  } else {
    elements.inputHint.textContent = isOnline
      ? "Nhấn Enter để gửi hoặc đính kèm ảnh/file."
      : "Người nhận đang offline. Tin nhắn vẫn được lưu vào database.";
  }
}

function switchSidebarTab(tab) {
  state.sidebarTab = tab;
  const tabs = [
    ["direct", elements.tabDirect, elements.panelDirect],
    ["online", elements.tabOnline, elements.panelOnline],
    ["public", elements.tabPublic, elements.panelPublic],
    ["groups", elements.tabGroups, elements.panelGroups]
  ];
  for (const [name, button, panel] of tabs) {
    button?.classList.toggle("is-active", name === tab);
    panel?.classList.toggle("is-hidden", name !== tab);
  }
}

function createPublicRoomItem() {
  if (!state.publicRoom) return null;
  const button = document.createElement("button");
  const avatar = document.createElement("span");
  const copy = document.createElement("span");
  const name = document.createElement("strong");
  const preview = document.createElement("span");
  button.type = "button";
  button.className = "user-item";
  if (state.chatMode === "public") button.classList.add("is-active");
  avatar.className = "avatar";
  setAvatar(avatar, "P");
  copy.className = "user-copy";
  name.textContent = state.publicRoom.name || "Phòng trò chuyện";
  preview.textContent = "Chat công khai cho mọi người";
  copy.append(name, preview);
  button.append(avatar, copy);
  if (state.publicRoom.unreadCount > 0) {
    const badge = document.createElement("span");
    badge.className = "unread-badge";
    badge.textContent = String(state.publicRoom.unreadCount);
    button.append(badge);
  }
  button.addEventListener("click", () => selectPublicRoom());
  return button;
}

function createGroupItem(group) {
  const button = document.createElement("button");
  const avatar = document.createElement("span");
  const copy = document.createElement("span");
  const name = document.createElement("strong");
  const preview = document.createElement("span");
  button.type = "button";
  button.className = "user-item";
  if (
    state.chatMode === "group" &&
    state.selectedConversationId === group.conversationId
  ) {
    button.classList.add("is-active");
  }
  avatar.className = "avatar";
  setAvatar(avatar, group.name || "G");
  copy.className = "user-copy";
  name.textContent = group.name || "Nhóm chat";
  const last = group.lastMessage;
  preview.textContent = last
    ? last.type === "image"
      ? "Đã gửi ảnh"
      : last.type === "voice"
        ? "Tin thoại"
        : last.body || "Tin nhắn mới"
    : "Bắt đầu trò chuyện nhóm";
  copy.append(name, preview);
  button.append(avatar, copy);
  if (group.unreadCount > 0) {
    const badge = document.createElement("span");
    badge.className = "unread-badge";
    badge.textContent = String(group.unreadCount);
    button.append(badge);
  }
  button.addEventListener("click", () => selectGroup(group));
  return button;
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
      : last.type === "voice"
        ? "Tin thoại"
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

  const publicItem = createPublicRoomItem();
  elements.publicRoomList?.replaceChildren(
    ...(publicItem ? [publicItem] : [])
  );
  elements.groupList?.replaceChildren(
    ...state.groups.map(createGroupItem)
  );

  const totalVisible =
    state.conversations.length +
    availableOnline.length +
    (state.publicRoom ? 1 : 0) +
    state.groups.length;
  elements.onlineCount.textContent = String(state.onlineUsers.length);
  elements.emptyUsers?.classList.toggle("is-hidden", totalVisible > 0);
}

function openChatPanel() {
  elements.emptyState.classList.add("is-hidden");
  elements.chatPanel.classList.remove("is-hidden");
  elements.typingStatus.classList.add("is-hidden");
  closeSidebar();
}

function selectConversation(conversation) {
  state.chatMode = "direct";
  state.activeConversation = null;
  state.selectedConversationId = conversation.conversationId;
  state.selectedUser = conversation.otherUser;
  state.unread.delete(conversation.otherUser.id);
  clearReplyTarget();
  hideSearchResults();
  if (elements.messageSearchInput) elements.messageSearchInput.value = "";
  clearSelectedFile();
  openChatPanel();
  const isOnline = state.onlineUsers.some(
    (user) => user.id === conversation.otherUser.id
  );
  renderConversationHeader(conversation.otherUser, isOnline);
  clearMessages();
  renderSidebar();
  loadMessages({ reset: true });
}

function selectPublicRoom() {
  if (!state.publicRoom) return;
  state.chatMode = "public";
  state.selectedUser = null;
  state.activeConversation = state.publicRoom;
  state.selectedConversationId = state.publicRoom.id;
  clearSelectedFile();
  hideSearchResults();
  openChatPanel();
  renderConversationHeader();
  clearMessages();
  renderSidebar();
  socket.emit("join_conversation", {
    conversationId: state.selectedConversationId
  });
  loadMessages({ reset: true });
}

function selectGroup(group) {
  state.chatMode = "group";
  state.selectedUser = null;
  state.activeConversation = group;
  state.selectedConversationId = group.conversationId;
  clearSelectedFile();
  hideSearchResults();
  openChatPanel();
  renderConversationHeader();
  clearMessages();
  renderSidebar();
  socket.emit("join_conversation", {
    conversationId: state.selectedConversationId
  });
  loadMessages({ reset: true });
}

function startChatWithOnlineUser(user) {
  switchSidebarTab("direct");
  const existing = state.conversations.find(
    (item) => item.otherUser.id === user.id
  );
  if (existing) {
    selectConversation(existing);
    return;
  }

  state.chatMode = "direct";
  state.activeConversation = null;
  state.selectedConversationId = null;
  state.selectedUser = user;
  clearSelectedFile();
  openChatPanel();
  renderConversationHeader(user, true);
  clearMessages();
  renderSidebar();
  elements.messageInput.focus();
}

function loadMessages({ reset = false } = {}) {
  if (!state.selectedConversationId || state.isLoadingOlder) return;

  state.isLoadingOlder = !reset;
  socket.emit(
    "load_messages",
    {
      conversationId: state.selectedConversationId,
      limit: 30,
      cursor: reset ? null : state.nextCursor
    },
    (response) => {
      state.isLoadingOlder = false;
      if (!response?.ok) {
        appendSystemMessage(response?.error || "Không thể tải tin nhắn.");
        return;
      }

      if (reset) clearMessages();
      if (reset) response.messages.forEach(appendMessage);
      else prependMessages(response.messages);

      state.nextCursor = response.nextCursor;
      state.hasMoreMessages = Boolean(response.hasMore);
      if (response.otherUser) {
        state.selectedUser = response.otherUser;
      }
      const lastMessage = response.messages.at(-1);
      if (reset && lastMessage) {
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

function loadPublicRoom() {
  socket.emit("load_public_room", {}, (response) => {
    if (!response?.ok) {
      showToast(response?.error || "Không thể tải phòng chung.", "error");
      return;
    }
    state.publicRoom = response.room;
    renderSidebar();
  });
}

function loadGroups() {
  socket.emit("load_groups", {}, (response) => {
    if (!response?.ok) {
      showToast(response?.error || "Không thể tải nhóm.", "error");
      return;
    }
    state.groups = response.groups || [];
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
    state.currentUser = response.user;
    state.publicRoom = response.publicRoom || null;
    elements.currentUsername.textContent =
      response.user.displayName || response.user.username;
    setAvatar(
      elements.currentAvatar,
      response.user.displayName || response.user.username
    );
    setConnectionVisible(false);
    loadConversations();
    loadPublicRoom();
    loadGroups();
  });
}

function handleIncomingRoomMessage(message, mode) {
  const belongsToSelected =
    state.selectedConversationId &&
    message.conversationId === state.selectedConversationId &&
    state.chatMode === mode;

  if (belongsToSelected) {
    appendMessage(message);
    socket.emit("mark_read", {
      conversationId: message.conversationId,
      messageId: message.id
    });
    return;
  }

  if (message.senderId !== state.currentUser?.id) {
    if (mode === "public") loadPublicRoom();
    else loadGroups();
    const preview =
      message.type === "image"
        ? "một ảnh"
        : message.type === "voice"
          ? "một tin thoại"
          : message.type === "file"
            ? "một file"
            : "một tin nhắn";
    const label =
      mode === "public"
        ? state.publicRoom?.name || "Phòng chung"
        : "Nhóm chat";
    showToast(`${message.senderName} vừa gửi ${preview} trong ${label}.`);
  } else if (mode === "public") {
    loadPublicRoom();
  } else {
    loadGroups();
  }
}

function uploadFileWithProgress(file, extraFields = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      const csrfToken = await ensureCsrfToken();
      const formData = new FormData();
      formData.append("file", file);
      for (const [key, value] of Object.entries(extraFields)) {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      }

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/uploads");
      xhr.withCredentials = true;
      xhr.setRequestHeader("X-CSRF-Token", csrfToken);
      xhr.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      });
      xhr.addEventListener("load", () => {
        setUploadProgress(null);
        let result = {};
        try {
          result = JSON.parse(xhr.responseText || "{}");
        } catch (_error) {
          reject(new Error("Phản hồi upload không hợp lệ."));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300 && result.ok) {
          resolve(result.file);
          return;
        }
        reject(new Error(result.error || "Không thể upload file."));
      });
      xhr.addEventListener("error", () => {
        setUploadProgress(null);
        reject(new Error("Không thể upload file."));
      });
      xhr.send(formData);
    } catch (error) {
      setUploadProgress(null);
      reject(error);
    }
  });
}

async function uploadSelectedFile(file, extraFields = {}) {
  return uploadFileWithProgress(file, extraFields);
}

function getMessageSocketEvent() {
  if (state.chatMode === "public") return "public_message";
  if (state.chatMode === "group") return "group_message";
  return "private_message";
}

async function sendCurrentMessage(payload) {
  const eventName = getMessageSocketEvent();
  const body = { ...payload };

  if (state.chatMode === "direct") {
    body.receiverId = state.selectedUser.id;
    body.conversationId = state.selectedConversationId;
  } else {
    body.conversationId = state.selectedConversationId;
  }

  const response = await emitSocketAck(eventName, body);
  if (!response?.ok) {
    throw new Error(response?.error || "Không thể gửi tin nhắn.");
  }

  if (state.chatMode === "direct" && response.message?.conversationId) {
    state.selectedConversationId = response.message.conversationId;
    loadConversations();
  } else if (state.chatMode === "public") {
    loadPublicRoom();
  } else if (state.chatMode === "group") {
    loadGroups();
  }

  return response;
}

async function sendFileMessage(fileMeta) {
  await sendCurrentMessage({
    type: fileMeta.kind,
    fileUrl: fileMeta.fileUrl,
    fileKey: fileMeta.fileKey,
    fileName: fileMeta.fileName,
    mimeType: fileMeta.mimeType,
    size: fileMeta.size,
    durationMs: fileMeta.durationMs || null,
    replyToMessageId: state.replyTo?.id || null
  });
}

async function sendTextMessage(text) {
  await sendCurrentMessage({
    type: "text",
    message: text,
    replyToMessageId: state.replyTo?.id || null
  });
  clearReplyTarget();
}

function updateRecordingTimer() {
  if (!state.recording?.startedAt || !elements.recordingTimer) return;
  const elapsed = Date.now() - state.recording.startedAt;
  elements.recordingTimer.textContent = formatDuration(elapsed);
}

function hideRecordingUi() {
  elements.recordingStatus?.classList.add("is-hidden");
  elements.recordButton?.classList.remove("is-recording");
  if (state.recording?.timerId) {
    window.clearInterval(state.recording.timerId);
  }
  if (state.recording?.stream) {
    state.recording.stream.getTracks().forEach((track) => track.stop());
  }
  state.recording = null;
  setComposerDisabled(false);
}

async function startRecording() {
  if (!state.selectedUser || state.isUploading || state.selectedFile) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast("Trình duyệt không hỗ trợ ghi âm.", "error");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "audio/ogg";
    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });

    mediaRecorder.start(250);
    state.recording = {
      mediaRecorder,
      stream,
      chunks,
      mimeType,
      startedAt: Date.now(),
      timerId: window.setInterval(() => {
        updateRecordingTimer();
        const elapsed = Date.now() - state.recording.startedAt;
        if (elapsed >= MAX_VOICE_SECONDS * 1000) {
          stopRecording();
        }
      }, 250)
    };

    elements.recordingStatus?.classList.remove("is-hidden");
    elements.recordButton?.classList.add("is-recording");
    updateRecordingTimer();
    setComposerDisabled(true);
  } catch (_error) {
    showToast("Không thể truy cập microphone.", "error");
  }
}

function stopRecording() {
  if (!state.recording) return;
  const { mediaRecorder } = state.recording;
  if (mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  updateRecordingTimer();
}

function cancelRecording() {
  hideRecordingUi();
}

async function sendVoiceRecording() {
  if (!state.recording || !state.selectedUser) return;

  const recording = state.recording;
  await new Promise((resolve) => {
    if (recording.mediaRecorder.state === "inactive") {
      resolve();
      return;
    }
    recording.mediaRecorder.addEventListener("stop", resolve, { once: true });
    recording.mediaRecorder.stop();
  });

  const durationMs = Date.now() - recording.startedAt;
  const chunks = [...recording.chunks];
  const mimeType = recording.mimeType;
  hideRecordingUi();

  if (durationMs < 500) {
    showToast("Tin thoại quá ngắn.", "error");
    return;
  }

  const blob = new Blob(chunks, { type: mimeType });
  const file = new File([blob], `voice-${Date.now()}.webm`, {
    type: mimeType
  });

  state.isUploading = true;
  setComposerDisabled(true);
  renderConversationHeader();

  try {
    const fileMeta = await uploadSelectedFile(file, {
      kind: "voice",
      durationMs
    });
    await sendFileMessage(fileMeta);
    clearReplyTarget();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    state.isUploading = false;
    renderConversationHeader();
    setComposerDisabled(false);
  }
}

async function handleMessageSubmit() {
  if (state.chatMode === "direct" && !state.selectedUser) {
    showToast("Vui lòng chọn người để chat.", "error");
    return;
  }
  if (
    (state.chatMode === "public" || state.chatMode === "group") &&
    !state.selectedConversationId
  ) {
    showToast("Vui lòng chọn phòng hoặc nhóm để chat.", "error");
    return;
  }

  const text = elements.messageInput.value.trim();
  const file = state.selectedFile;
  if (!file && !text) return;

  if (
    state.chatMode === "direct" &&
    state.isTyping &&
    state.selectedConversationId &&
    state.selectedUser
  ) {
    state.isTyping = false;
    socket.emit("stop_typing", {
      conversationId: state.selectedConversationId,
      receiverId: state.selectedUser.id
    });
  }

  state.isUploading = Boolean(file);
  setComposerDisabled(true);
  const isOnline =
    state.chatMode === "direct" && state.selectedUser
      ? state.onlineUsers.some((user) => user.id === state.selectedUser.id)
      : true;
  renderConversationHeader(state.selectedUser, isOnline);

  try {
    if (file) {
      const fileMeta = await uploadSelectedFile(file);
      await sendFileMessage(fileMeta);
      clearSelectedFile();
      clearReplyTarget();
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
    renderConversationHeader();
    setComposerDisabled(false);
  }
}

function openGroupModal() {
  elements.groupError.textContent = "";
  elements.groupNameInput.value = "";
  elements.groupMembersInput.value = "";
  elements.groupModal?.classList.remove("is-hidden");
}

function closeGroupModal() {
  elements.groupModal?.classList.add("is-hidden");
}

function switchAuthTab(tab) {
  const isLogin = tab === "login";
  const isRegister = tab === "register";
  const isForgot = tab === "forgot";

  elements.loginTab?.classList.toggle("is-active", isLogin);
  elements.registerTab?.classList.toggle("is-active", isRegister);
  elements.forgotTab?.classList.toggle("is-active", isForgot);
  elements.loginTab?.setAttribute("aria-selected", String(isLogin));
  elements.registerTab?.setAttribute("aria-selected", String(isRegister));
  elements.forgotTab?.setAttribute("aria-selected", String(isForgot));
  elements.loginForm?.classList.toggle("is-hidden", !isLogin);
  elements.registerForm?.classList.toggle("is-hidden", !isRegister);
  elements.forgotForm?.classList.toggle("is-hidden", !isForgot);

  if (isForgot) {
    state.forgotStep = "request";
    state.forgotResetTokenId = null;
    if (elements.forgotSubmitButton) {
      elements.forgotSubmitButton.querySelector("span").textContent = "Gửi OTP";
    }
    if (elements.forgotHint) {
      elements.forgotHint.textContent =
        "Bước 1: gửi OTP. Bước 2: nhập OTP + mật khẩu mới.";
    }
  }
}

function openProfileModal() {
  if (!state.currentUser || !elements.profileModal) return;
  elements.profileDisplayName.value = state.currentUser.displayName || "";
  elements.profileBio.value = state.currentUser.bio || "";
  elements.profileEmail.value = state.currentUser.email || "";
  elements.profileError.textContent = "";
  elements.profileModal.classList.remove("is-hidden");
}

function closeProfileModal() {
  elements.profileModal?.classList.add("is-hidden");
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
  elements.forgotTab?.addEventListener("click", () => switchAuthTab("forgot"));
  elements.openForgotFromLogin?.addEventListener("click", () =>
    switchAuthTab("forgot")
  );

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

  elements.forgotForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    elements.forgotError.textContent = "";
    const formData = new FormData(elements.forgotForm);
    const email = String(formData.get("email") || "").trim();

    try {
      if (state.forgotStep === "request") {
        const result = await api("/api/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email })
        });
        state.forgotStep = "reset";
        if (elements.forgotSubmitButton) {
          elements.forgotSubmitButton.querySelector("span").textContent =
            "Đặt lại mật khẩu";
        }
        if (elements.forgotHint) {
          elements.forgotHint.textContent = result.message;
        }
        showToast(result.message, "success");
        return;
      }

      const verify = await api("/api/auth/verify-reset-otp", {
        method: "POST",
        body: JSON.stringify({
          email,
          otp: String(formData.get("otp") || "").trim()
        })
      });
      state.forgotResetTokenId = verify.resetTokenId;

      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          resetTokenId: state.forgotResetTokenId,
          password: formData.get("password"),
          confirmPassword: formData.get("confirmPassword")
        })
      });

      showToast("Đặt lại mật khẩu thành công. Vui lòng đăng nhập.", "success");
      switchAuthTab("login");
    } catch (error) {
      elements.forgotError.textContent = error.message;
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
    .then(async (data) => {
      state.currentUser = data.user;
      try {
        const profile = await api("/api/users/me");
        state.currentUser = profile.user;
      } catch (_error) {
        // fallback auth/me profile
      }
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

  elements.messageSearchButton?.addEventListener("click", runMessageSearch);
  elements.messageSearchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runMessageSearch();
    }
  });
  elements.cancelReplyButton?.addEventListener("click", clearReplyTarget);

  elements.messages?.addEventListener("scroll", () => {
    if (
      elements.messages.scrollTop < 80 &&
      state.hasMoreMessages &&
      !state.isLoadingOlder &&
      state.selectedConversationId
    ) {
      loadMessages({ reset: false });
    }
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

  elements.recordButton?.addEventListener("click", () => {
    if (state.recording) {
      stopRecording();
      return;
    }
    startRecording();
  });
  elements.cancelRecordingButton?.addEventListener("click", cancelRecording);
  elements.sendRecordingButton?.addEventListener("click", sendVoiceRecording);

  elements.tabDirect?.addEventListener("click", () => switchSidebarTab("direct"));
  elements.tabOnline?.addEventListener("click", () => switchSidebarTab("online"));
  elements.tabPublic?.addEventListener("click", () => switchSidebarTab("public"));
  elements.tabGroups?.addEventListener("click", () => switchSidebarTab("groups"));
  elements.createGroupButton?.addEventListener("click", openGroupModal);
  elements.groupCloseButton?.addEventListener("click", closeGroupModal);
  elements.groupModal?.addEventListener("click", (event) => {
    if (event.target === elements.groupModal) closeGroupModal();
  });
  elements.groupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    elements.groupError.textContent = "";
    const name = elements.groupNameInput.value.trim();
    const memberNames = elements.groupMembersInput.value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const memberIds = [];
    for (const memberName of memberNames) {
      const found = state.onlineUsers.find(
        (user) =>
          user.username === memberName ||
          user.displayName === memberName
      );
      if (found) memberIds.push(found.id);
    }
    try {
      const result = await api("/api/conversations/groups", {
        method: "POST",
        body: JSON.stringify({ name, memberIds })
      });
      closeGroupModal();
      loadGroups();
      switchSidebarTab("groups");
      if (result.group) {
        selectGroup({
          conversationId: result.group.id,
          name: result.group.name,
          unreadCount: 0
        });
      }
      showToast("Đã tạo nhóm.", "success");
    } catch (error) {
      elements.groupError.textContent = error.message;
    }
  });

  elements.messageInput.addEventListener("input", () => {
    if (
      state.chatMode !== "direct" ||
      !state.selectedUser ||
      !state.selectedConversationId
    ) {
      return;
    }
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

  elements.profileButton?.addEventListener("click", openProfileModal);
  elements.profileCloseButton?.addEventListener("click", closeProfileModal);
  elements.profileModal?.addEventListener("click", (event) => {
    if (event.target === elements.profileModal) {
      closeProfileModal();
    }
  });

  elements.profileForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    elements.profileError.textContent = "";

    try {
      const updated = await api("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: elements.profileDisplayName.value,
          bio: elements.profileBio.value,
          email: elements.profileEmail.value
        })
      });
      state.currentUser = updated.user;
      elements.currentUsername.textContent =
        updated.user.displayName || updated.user.username;
      setAvatar(
        elements.currentAvatar,
        updated.user.displayName || updated.user.username,
        updated.user.avatarUrl
      );

      const avatarFile = elements.profileAvatarFile?.files?.[0];
      if (avatarFile) {
        const csrfToken = await ensureCsrfToken();
        const formData = new FormData();
        formData.append("avatar", avatarFile);
        const response = await fetch("/api/users/me/avatar", {
          method: "POST",
          credentials: "include",
          headers: { "X-CSRF-Token": csrfToken },
          body: formData
        });
        const avatarData = await response.json();
        if (!response.ok || !avatarData.ok) {
          throw new Error(avatarData.error || "Không thể upload ảnh đại diện.");
        }
        state.currentUser = avatarData.user;
        setAvatar(
          elements.currentAvatar,
          avatarData.user.displayName || avatarData.user.username,
          avatarData.user.avatarUrl
        );
      }

      const oldPassword = elements.profileOldPassword.value;
      const newPassword = elements.profileNewPassword.value;
      const confirmPassword = elements.profileConfirmPassword.value;
      if (oldPassword || newPassword || confirmPassword) {
        await api("/api/users/me/change-password", {
          method: "POST",
          body: JSON.stringify({
            oldPassword,
            password: newPassword,
            confirmPassword
          })
        });
        showToast("Đổi mật khẩu thành công. Vui lòng đăng nhập lại.", "success");
        closeProfileModal();
        socket.disconnect();
        window.location.href = "/";
        return;
      }

      showToast("Đã cập nhật hồ sơ.", "success");
      closeProfileModal();
    } catch (error) {
      elements.profileError.textContent = error.message;
    }
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

  socket.on("public_message", (message) => {
    handleIncomingRoomMessage(message, "public");
  });

  socket.on("group_message", (message) => {
    handleIncomingRoomMessage(message, "group");
  });

  socket.on("private_message", (message) => {
    const belongsToSelected =
      state.chatMode === "direct" &&
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
          : message.type === "voice"
            ? "một tin thoại"
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

  socket.on("message_edited", ({ conversationId, message }) => {
    if (conversationId !== state.selectedConversationId || !message) return;
    updateMessageRow(message);
  });

  socket.on("message_deleted", ({ conversationId, message }) => {
    if (conversationId !== state.selectedConversationId || !message) return;
    updateMessageRow(message);
  });

  socket.on("message_reaction_added", ({ conversationId, messageId, reactions }) => {
    if (conversationId !== state.selectedConversationId) return;
    const row = state.messageRows.get(messageId);
    const reactionsEl = row?.querySelector(".message-reactions");
    if (reactionsEl) renderReactionChips(reactionsEl, { id: messageId, reactions });
  });

  socket.on("message_reaction_removed", ({ conversationId, messageId, reactions }) => {
    if (conversationId !== state.selectedConversationId) return;
    const row = state.messageRows.get(messageId);
    const reactionsEl = row?.querySelector(".message-reactions");
    if (reactionsEl) renderReactionChips(reactionsEl, { id: messageId, reactions });
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