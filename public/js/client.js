const page = document.body.dataset.page;
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
  tabAi: document.getElementById("tabAi"),
  panelDirect: document.getElementById("panelDirect"),
  panelOnline: document.getElementById("panelOnline"),
  panelPublic: document.getElementById("panelPublic"),
  panelGroups: document.getElementById("panelGroups"),
  panelAi: document.getElementById("panelAi"),
  userSearchInput: document.getElementById("userSearchInput"),
  userSearchResults: document.getElementById("userSearchResults"),
  aiSessionList: document.getElementById("aiSessionList"),
  newAiSessionButton: document.getElementById("newAiSessionButton"),
  groupMembersButton: document.getElementById("groupMembersButton"),
  leaveGroupButton: document.getElementById("leaveGroupButton"),
  groupMembersModal: document.getElementById("groupMembersModal"),
  groupMembersCloseButton: document.getElementById("groupMembersCloseButton"),
  groupMembersList: document.getElementById("groupMembersList"),
  addMemberForm: document.getElementById("addMemberForm"),
  addMemberInput: document.getElementById("addMemberInput"),
  addMemberError: document.getElementById("addMemberError"),
  publicRoomList: document.getElementById("publicRoomList"),
  groupList: document.getElementById("groupList"),
  createGroupButton: document.getElementById("createGroupButton"),
  groupModal: document.getElementById("groupModal"),
  groupCloseButton: document.getElementById("groupCloseButton"),
  groupForm: document.getElementById("groupForm"),
  groupNameInput: document.getElementById("groupNameInput"),
  groupMembersInput: document.getElementById("groupMembersInput"),
  groupIconButton: document.getElementById("groupIconButton"),
  groupIconPreview: document.getElementById("groupIconPreview"),
  groupIconColor: document.getElementById("groupIconColor"),
  groupError: document.getElementById("groupError"),
  conversationTypeChip: document.getElementById("conversationTypeChip"),
  adminLink: document.getElementById("adminLink")
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
  aiSessions: [],
  aiSessionId: null,
  userSearchTimer: null,
  messageSearchTimer: null,
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
  previewObjectUrl: null,
  isUploading: false,
  nextCursor: null,
  isLoadingOlder: false,
  hasMoreMessages: false,
  loadedMessageIds: new Set(),
  messageRows: new Map(),
  replyTo: null,
  recording: null,
  forgotResetTokenId: null,
  forgotStep: "request",
  iconConfig: {
    allowedPrefixes: ["lucide", "mdi", "material-symbols"],
    defaultPrefix: "lucide",
    maxSearchResults: 60
  },
  selectedGroupIcon: {
    iconName: "lucide:users",
    color: "#22c55e"
  },
  iconSearchTimer: null
};

if (typeof window !== "undefined") {
  window.elements = elements;
  window.state = state;
  window.socket = socket;
}

// api/ensure moved to api.js (window.api / window.ensureCsrfToken)
function getInitials(name = "") {
  return (window.getInitials ? window.getInitials(name) : name.split(/\s+/).filter(Boolean).slice(-2).map(p => p.charAt(0).toUpperCase()).join(""));
}

function renderConversationIcon(element, conversation, fallbackName) {
  if (!element) return;
  element.replaceChildren();
  element.style.backgroundImage = "";
  element.classList.remove("conversation-icon");
  const iconName = conversation?.iconName;
  const safeCheck = (typeof isSafeIconName === "function" ? isSafeIconName : (window.isSafeIconName || (() => false)));
  const iconCreate = (typeof createIconElement === "function" ? createIconElement : window.createIconElement);
  if (safeCheck(iconName)) {
    element.classList.add("conversation-icon");
    const icon = iconCreate ? iconCreate(iconName, conversation.iconColor, "group-icon") : null;
    if (icon) {
      element.append(icon);
      return;
    }
  }
  element.textContent = getInitials(fallbackName || "");
}

function setAvatar(element, name, avatarUrl) {
  if (!element) return;
  if (avatarUrl) {
    element.textContent = "";
    element.replaceChildren();
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
  const A = (window.ALLOWED_MIME_TYPES || new Set()); const M = window.MAX_UPLOAD_BYTES || 6291456;
  return Boolean(file) && A.has(file.type) && file.size <= M;
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

function isStaffUser() {
  const role = state.currentUser?.role;
  return role === "admin" || role === "moderator";
}

function updateAdminLink() {
  if (!elements.adminLink) return;
  if (isStaffUser()) {
    elements.adminLink.classList.remove("is-hidden");
  } else {
    elements.adminLink.classList.add("is-hidden");
  }
}

function canModerateMessage(message) {
  if (!message || message.isDeleted) return false;
  return isStaffUser();
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

function normalizeReactionForClient(reaction) {
  const reactionType = reaction.type || reaction.reactionType || (reaction.iconName ? "icon" : "emoji");
  const value = reaction.value || reaction.emoji || reaction.iconName;
  return {
    ...reaction,
    reactionType,
    value,
    color: (typeof normalizeHexColor === "function" ? normalizeHexColor(reaction.color || reaction.iconColor) : (window.normalizeHexColor ? window.normalizeHexColor(reaction.color || reaction.iconColor) : null))
  };
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
  for (const reaction of reactions.map(normalizeReactionForClient)) {
    if (!reaction.value) continue;
    const key = `${reaction.reactionType}:${reaction.value}:${reaction.color || ""}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(reaction);
  }
  for (const items of grouped.values()) {
    const sample = items[0];
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "message-reaction-chip";
    if (sample.reactionType === "icon") chip.classList.add("icon-reaction");
    const reacted = items.some((item) => item.userId === state.currentUser?.id);
    if (reacted) chip.classList.add("is-own");
    if (sample.reactionType === "icon") {
      const icon = (typeof createIconElement === "function" ? createIconElement : window.createIconElement || (()=>null))(sample.value, sample.color, "reaction-icon");
      if (icon) chip.append(icon);
      else chip.textContent = "Icon";
    } else {
      const emoji = document.createElement("span");
      emoji.textContent = sample.value;
      chip.append(emoji);
    }
    const count = document.createElement("span");
    count.textContent = String(items.length);
    chip.append(count);
    chip.title = items
      .map((item) => item.displayName || item.username || "User")
      .join(", ");
    chip.addEventListener("click", () =>
      toggleReaction(message.id, sample.reactionType, sample.value, reacted, sample.color)
    );
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

  if (canDeleteOwnMessage(message) || canModerateMessage(message)) {
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "message-action-btn";
    deleteBtn.textContent = canModerateMessage(message) && !canDeleteOwnMessage(message)
      ? "Xóa (mod)"
      : "Xóa";
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

// icon picker logic moved to /js/icon-picker.js (loaded before client.js)
function createIconPicker(opts) {
  if (typeof window.createIconPicker === "function") {
    return window.createIconPicker(opts);
  }
  console.warn("icon-picker not loaded");
}

function openReactionPicker(messageId) {
  if (typeof window.openReactionPicker === "function") {
    return window.openReactionPicker(messageId);
  }
  // fallback minimal
  const picker = document.createElement("div");
  picker.className = "reaction-picker";
  for (const emoji of (window.ALLOWED_REACTIONS || ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "👏"])) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "reaction-btn";
    btn.textContent = emoji;
    btn.addEventListener("click", () => {
      addReaction(messageId, "emoji", emoji);
      picker.remove();
    });
    picker.append(btn);
  }
  picker.append(document.createTextNode(" (icon picker unavailable)"));
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

async function addReaction(messageId, reactionType, value, color = null) {
  const payload =
    reactionType === "icon"
      ? { messageId, reactionType: "icon", value, color }
      : { messageId, reactionType: "emoji", value, emoji: value };
  const response = await emitSocketAck("add_reaction", payload);
  if (!response?.ok) {
    showToast(response?.error || "Không thể thêm reaction.", "error");
  }
}

async function toggleReaction(messageId, reactionType, value, hasReacted, color = null) {
  const eventName = hasReacted ? "remove_reaction" : "add_reaction";
  const payload =
    reactionType === "icon"
      ? { messageId, reactionType: "icon", value, color }
      : { messageId, reactionType: "emoji", value, emoji: value };
  const response = await emitSocketAck(eventName, payload);
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
    button.addEventListener("click", async () => {
      hideSearchResults();
      const row = state.messageRows.get(message.id);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.classList.add("is-highlighted");
        window.setTimeout(() => row.classList.remove("is-highlighted"), 2000);
        return;
      }
      // not loaded: toast + attempt to load more context (best effort)
      showToast("Tin nhắn nằm ngoài phần đã tải.");
      // try load recent (user can scroll up for older); full around would require backend anchor
      if (state.selectedConversationId && typeof loadMessages === "function") {
        try { await new Promise(r => { loadMessages({ reset: true }); setTimeout(r, 300); }); } catch (_) {}
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
  image.addEventListener("error", async () => {
    if (message.fileKey) {
      try {
        const freshUrl = await refreshMediaUrl(message.fileKey);
        message.fileUrl = freshUrl;
        image.src = freshUrl;
        link.href = freshUrl;
        image.classList.remove("is-hidden");
        fallback.classList.add("is-hidden");
        return;
      } catch (_error) {
        // fall through to fallback UI
      }
    }
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
  audio.addEventListener("error", async () => {
    if (!message.fileKey) return;
    try {
      const freshUrl = await refreshMediaUrl(message.fileKey);
      message.fileUrl = freshUrl;
      audio.src = freshUrl;
    } catch (_error) {
      meta.textContent = "Không thể phát tin thoại.";
    }
  });
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
  if (state.previewObjectUrl) {
    URL.revokeObjectURL(state.previewObjectUrl);
    state.previewObjectUrl = null;
  }
  elements.selectedFileName.textContent = file.name;
  elements.selectedFileSize.textContent = formatFileSize(file.size);
  if (file.type?.startsWith("image/")) {
    state.previewObjectUrl = URL.createObjectURL(file);
  }
  elements.selectedFilePreview.classList.remove("is-hidden");
}

function clearSelectedFile() {
  if (state.previewObjectUrl) {
    URL.revokeObjectURL(state.previewObjectUrl);
    state.previewObjectUrl = null;
  }
  state.selectedFile = null;
  if (elements.fileInput) elements.fileInput.value = "";
  elements.selectedFilePreview?.classList.add("is-hidden");
}

async function refreshMediaUrl(fileKey) {
  const csrfToken = await ensureCsrfToken();
  const response = await fetch("/api/uploads/refresh-url", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken
    },
    body: JSON.stringify({ fileKey })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok || !data.fileUrl) {
    throw new Error(data.error || "Không thể làm mới URL file.");
  }
  return data.fileUrl;
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
    renderConversationIcon(elements.selectedAvatar, state.publicRoom, "P");
    elements.selectedStatus.classList.remove("is-offline");
    elements.selectedStatus.lastChild.textContent = "Phòng công khai";
    elements.conversationTypeChip.textContent = "Phòng chung";
    elements.chatPanel.classList.remove("is-offline");
  } else if (state.chatMode === "group" && state.activeConversation) {
    elements.selectedUsername.textContent =
      state.activeConversation.name || "Nhóm chat";
    renderConversationIcon(
      elements.selectedAvatar,
      state.activeConversation,
      state.activeConversation.name || "G"
    );
    elements.selectedStatus.classList.remove("is-offline");
    elements.selectedStatus.lastChild.textContent = "Nhóm chat";
    elements.conversationTypeChip.textContent = "Nhóm";
    elements.chatPanel.classList.remove("is-offline");
    elements.groupMembersButton?.classList.remove("is-hidden");
    elements.leaveGroupButton?.classList.remove("is-hidden");
  } else if (state.chatMode === "ai") {
    elements.selectedUsername.textContent = "AI Bot";
    setAvatar(elements.selectedAvatar, "AI");
    elements.selectedStatus.lastChild.textContent = "Trợ lý AI";
    elements.conversationTypeChip.textContent = "AI";
    elements.groupMembersButton?.classList.add("is-hidden");
    elements.leaveGroupButton?.classList.add("is-hidden");
    elements.attachButton.disabled = true;
    elements.recordButton.disabled = true;
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
    elements.groupMembersButton?.classList.add("is-hidden");
    elements.leaveGroupButton?.classList.add("is-hidden");
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
    ["groups", elements.tabGroups, elements.panelGroups],
    ["ai", elements.tabAi, elements.panelAi]
  ];
  for (const [name, button, panel] of tabs) {
    button?.classList.toggle("is-active", name === tab);
    button?.setAttribute("aria-selected", name === tab ? "true" : "false");
    panel?.classList.toggle("is-hidden", name !== tab);
  }
  if (tab === "ai") {
    loadAiSessions();
  }
}

async function searchUsersDebounced() {
  const q = elements.userSearchInput?.value?.trim() || "";
  if (!elements.userSearchResults) return;
  if (q.length < 2) {
    elements.userSearchResults.classList.add("is-hidden");
    elements.userSearchResults.replaceChildren();
    return;
  }
  try {
    const result = await api(`/api/users/search?q=${encodeURIComponent(q)}`);
    elements.userSearchResults.replaceChildren();
    for (const user of result.users || []) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "user-item";
      const avatar = document.createElement("span");
      avatar.className = "avatar";
      setAvatar(avatar, user.displayName || user.username, user.avatarUrl);
      const copy = document.createElement("span");
      copy.className = "user-copy";
      const name = document.createElement("strong");
      name.textContent = user.displayName || user.username;
      copy.append(name);
      button.append(avatar, copy);
      button.addEventListener("click", () => {
        elements.userSearchInput.value = "";
        elements.userSearchResults.classList.add("is-hidden");
        startChatWithOnlineUser(user);
      });
      elements.userSearchResults.append(button);
    }
    elements.userSearchResults.classList.toggle(
      "is-hidden",
      !(result.users || []).length
    );
  } catch (_error) {
    elements.userSearchResults.classList.add("is-hidden");
  }
}

function renderAiSessions() {
  if (!elements.aiSessionList) return;
  elements.aiSessionList.replaceChildren();
  for (const session of state.aiSessions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "user-item";
    if (state.chatMode === "ai" && state.aiSessionId === session.id) {
      button.classList.add("is-active");
    }
    const avatar = document.createElement("span");
    avatar.className = "avatar";
    setAvatar(avatar, "AI");
    const copy = document.createElement("span");
    copy.className = "user-copy";
    const name = document.createElement("strong");
    name.textContent = session.title || "Cuộc trò chuyện AI";
    copy.append(name);
    button.append(avatar, copy);
    button.addEventListener("click", () => selectAiSession(session.id));
    elements.aiSessionList.append(button);
  }
}

async function loadAiSessions() {
  try {
    const result = await api("/api/ai/sessions");
    state.aiSessions = result.sessions || [];
    renderAiSessions();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function selectAiSession(sessionId) {
  state.chatMode = "ai";
  state.aiSessionId = sessionId;
  state.selectedUser = null;
  state.selectedConversationId = null;
  clearSelectedFile();
  hideSearchResults();
  openChatPanel();
  elements.selectedUsername.textContent = "AI Bot";
  setAvatar(elements.selectedAvatar, "AI");
  elements.selectedStatus.lastChild.textContent = "Trợ lý AI";
  elements.conversationTypeChip.textContent = "AI";
  elements.groupMembersButton?.classList.add("is-hidden");
  elements.leaveGroupButton?.classList.add("is-hidden");
  elements.attachButton.disabled = true;
  elements.recordButton.disabled = true;
  clearMessages();
  renderAiSessions();
  try {
    const result = await api(`/api/ai/sessions/${sessionId}/messages`);
    for (const message of result.messages || []) {
      appendAiMessage(message);
    }
    elements.messageInput.disabled = false;
    elements.sendButton.disabled = false;
    elements.messageInput.focus();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function appendAiMessage(message) {
  const row = document.createElement("article");
  const bubble = document.createElement("div");
  const meta = document.createElement("span");
  const isAssistant = message.role === "assistant";
  row.className = `message-row${isAssistant ? "" : " is-own"}`;
  bubble.className = "message-bubble";
  bubble.textContent = message.content || "";
  meta.className = "message-meta";
  meta.textContent = isAssistant ? "AI Bot" : "Bạn";
  row.append(bubble, meta);
  elements.messages.append(row);
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

async function createAiSession() {
  try {
    const result = await api("/api/ai/sessions", {
      method: "POST",
      body: JSON.stringify({ title: "Cuộc trò chuyện AI" })
    });
    state.aiSessions.unshift(result.session);
    switchSidebarTab("ai");
    await selectAiSession(result.session.id);
  } catch (error) {
    showToast(error.message, "error");
  }
}

function showAiLoadingBubble() {
  if (!elements.messages) return null;
  const row = document.createElement("article");
  row.className = "message-row ai-loading";
  const bubble = document.createElement("div");
  bubble.className = "message-bubble is-loading";
  bubble.textContent = "AI đang trả lời...";
  const meta = document.createElement("span");
  meta.className = "message-meta";
  meta.textContent = "AI Bot";
  row.append(bubble, meta);
  elements.messages.append(row);
  elements.messages.scrollTop = elements.messages.scrollHeight;
  return row;
}

async function sendAiMessage(text) {
  appendAiMessage({ role: "user", content: text });
  const loadingRow = showAiLoadingBubble();
  try {
    const apiCall = api(`/api/ai/sessions/${state.aiSessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: text })
    });
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("AI phản hồi quá lâu. Vui lòng thử lại.")), 25000)
    );
    const result = await Promise.race([apiCall, timeout]);
    if (loadingRow && loadingRow.parentNode) loadingRow.parentNode.removeChild(loadingRow);
    if (result.userMessage) appendAiMessage(result.userMessage);
    if (result.assistantMessage) appendAiMessage(result.assistantMessage);
    loadAiSessions();
  } catch (error) {
    if (loadingRow && loadingRow.parentNode) loadingRow.parentNode.removeChild(loadingRow);
    const isTimeout = /quá lâu|timeout/i.test(error.message || "");
    showToast(isTimeout ? "AI phản hồi quá lâu. Vui lòng thử lại." : (error.message || "Lỗi khi gọi AI."), "error");
    throw error;
  }
}

async function openGroupMembersModal() {
  if (!state.selectedConversationId || state.chatMode !== "group") return;
  elements.addMemberError.textContent = "";
  elements.groupMembersModal?.classList.remove("is-hidden");
  try {
    const result = await api(
      `/api/conversations/${state.selectedConversationId}/participants`
    );
    elements.groupMembersList?.replaceChildren();
    for (const member of result.participants || []) {
      const item = document.createElement("div");
      item.className = "user-item";
      item.textContent = `${member.displayName || member.username} (${member.role || "member"})`;
      elements.groupMembersList?.append(item);
    }
  } catch (error) {
    showToast(error.message, "error");
  }
}

function closeGroupMembersModal() {
  elements.groupMembersModal?.classList.add("is-hidden");
}

async function leaveCurrentGroup() {
  if (!state.selectedConversationId || state.chatMode !== "group") return;
  if (!window.confirm("Rời nhóm này?")) return;
  try {
    await api(`/api/conversations/${state.selectedConversationId}/leave`, {
      method: "POST"
    });
    showToast("Đã rời nhóm.", "success");
    state.chatMode = "direct";
    state.selectedConversationId = null;
    state.activeConversation = null;
    elements.chatPanel.classList.add("is-hidden");
    elements.emptyState.classList.remove("is-hidden");
    loadGroups();
    switchSidebarTab("groups");
  } catch (error) {
    showToast(error.message, "error");
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
  renderConversationIcon(avatar, state.publicRoom, "P");
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
  renderConversationIcon(avatar, group, group.name || "G");
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
    updateAdminLink();
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

function inferUploadKind(file, extraFields = {}) {
  if (extraFields.kind) return extraFields.kind;
  if (file?.type?.startsWith("image/")) return "image";
  if (file?.type?.startsWith("audio/")) return "voice";
  return "file";
}

async function signUpload(file, extraFields = {}) {
  const csrfToken = await ensureCsrfToken();
  const kind = inferUploadKind(file, extraFields);
  const response = await fetch("/api/uploads/sign", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken
    },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      kind,
      durationMs:
        extraFields.durationMs === undefined ? null : extraFields.durationMs
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok || !data.upload) {
    throw new Error(data.error || "Không thể ký URL upload.");
  }
  return data.upload;
}

function putFileToSignedUrl(file, upload) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(upload.method || "PUT", upload.uploadUrl);
    const headers = upload.headers || {};
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      setUploadProgress(percent);
    });
    xhr.addEventListener("load", () => {
      setUploadProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error("Không thể upload file lên storage."));
    });
    xhr.addEventListener("error", () => {
      setUploadProgress(null);
      reject(new Error("Không thể upload file lên storage."));
    });
    xhr.send(file);
  });
}

async function uploadFileWithProgress(file, extraFields = {}) {
  const upload = await signUpload(file, extraFields);
  await putFileToSignedUrl(file, upload);
  return {
    kind: upload.kind,
    fileKey: upload.fileKey,
    fileName: upload.fileName,
    mimeType: upload.mimeType,
    size: upload.size,
    durationMs: upload.durationMs ?? extraFields.durationMs ?? null
  };
}

async function uploadSelectedFile(file, extraFields = {}, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await uploadFileWithProgress(file, extraFields);
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => window.setTimeout(resolve, 400 * attempt));
      }
    }
  }
  throw lastError;
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
  if (state.chatMode === "ai") {
    if (!state.aiSessionId) {
      showToast("Vui lòng chọn hoặc tạo phiên AI.", "error");
      return;
    }
    const text = elements.messageInput.value.trim();
    if (!text) return;
    state.isUploading = true;
    setComposerDisabled(true);
    try {
      await sendAiMessage(text);
      elements.messageInput.value = "";
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      state.isUploading = false;
      setComposerDisabled(false);
    }
    return;
  }

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

function renderGroupIconPreview() {
  if (!elements.groupIconPreview) return;
  elements.groupIconPreview.replaceChildren();
  const icon = (typeof createIconElement === "function" ? createIconElement : (window.createIconElement || (()=>null)))(
    state.selectedGroupIcon.iconName,
    state.selectedGroupIcon.color,
    "group-icon-preview-symbol"
  );
  if (icon) elements.groupIconPreview.append(icon);
  else elements.groupIconPreview.textContent = "G";
  if (elements.groupIconColor) elements.groupIconColor.value = state.selectedGroupIcon.color;
}

function openGroupModal() {
  elements.groupError.textContent = "";
  elements.groupNameInput.value = "";
  elements.groupMembersInput.value = "";
  state.selectedGroupIcon = { iconName: "lucide:users", color: "#22c55e" };
  renderGroupIconPreview();
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
      updateAdminLink();
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
  elements.messageSearchInput?.addEventListener("input", () => {
    window.clearTimeout(state.messageSearchTimer);
    state.messageSearchTimer = window.setTimeout(runMessageSearch, 400);
  });
  elements.messageSearchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runMessageSearch();
    }
  });
  elements.userSearchInput?.addEventListener("input", () => {
    window.clearTimeout(state.userSearchTimer);
    state.userSearchTimer = window.setTimeout(searchUsersDebounced, 350);
  });
  elements.tabAi?.addEventListener("click", () => switchSidebarTab("ai"));
  elements.newAiSessionButton?.addEventListener("click", createAiSession);
  elements.groupMembersButton?.addEventListener("click", openGroupMembersModal);
  elements.groupMembersCloseButton?.addEventListener("click", closeGroupMembersModal);
  elements.groupMembersModal?.addEventListener("click", (event) => {
    if (event.target === elements.groupMembersModal) closeGroupMembersModal();
  });
  elements.leaveGroupButton?.addEventListener("click", leaveCurrentGroup);
  elements.addMemberForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    elements.addMemberError.textContent = "";
    const username = elements.addMemberInput.value.trim();
    if (!username || !state.selectedConversationId) return;
    try {
      const search = await api(`/api/users/search?q=${encodeURIComponent(username)}`);
      const found = (search.users || []).find(
        (user) => user.username.toLowerCase() === username.toLowerCase()
      );
      if (!found) {
        elements.addMemberError.textContent = "Không tìm thấy người dùng.";
        return;
      }
      await api(`/api/conversations/${state.selectedConversationId}/participants`, {
        method: "POST",
        body: JSON.stringify({ userId: found.id })
      });
      elements.addMemberInput.value = "";
      await openGroupMembersModal();
      showToast("Đã thêm thành viên.", "success");
    } catch (error) {
      elements.addMemberError.textContent = error.message;
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
  elements.groupIconButton?.addEventListener("click", () => {
    createIconPicker({
      selectedIconName: state.selectedGroupIcon.iconName,
      selectedColor: state.selectedGroupIcon.color,
      onSelect: ({ iconName, color }) => {
        state.selectedGroupIcon = { iconName, color };
        renderGroupIconPreview();
      }
    });
  });
  elements.groupIconColor?.addEventListener("change", () => {
    const safeColor = (typeof normalizeHexColor === "function" ? normalizeHexColor : (window.normalizeHexColor || (()=>null)))(elements.groupIconColor.value);
    if (safeColor) state.selectedGroupIcon.color = safeColor;
    renderGroupIconPreview();
  });
  elements.groupModal?.addEventListener("click", (event) => {
    if (event.target === elements.groupModal) closeGroupModal();
  });
  elements.groupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    elements.groupError.textContent = "";
    const name = elements.groupNameInput.value.trim();
    const iconName = state.selectedGroupIcon.iconName;
    const iconColor = ((typeof normalizeHexColor === "function" ? normalizeHexColor : (window.normalizeHexColor || (()=>null)))(elements.groupIconColor?.value)) || state.selectedGroupIcon.color;
    const memberNames = elements.groupMembersInput.value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const memberIds = [];
    for (const memberName of memberNames) {
      if (!memberName) continue;
      try {
        // use /api/users/search to support offline users too (not only onlineUsers)
        const res = await api(`/api/users/search?q=${encodeURIComponent(memberName)}&limit=5`);
        const list = Array.isArray(res.users) ? res.users : [];
        const found = list.find(
          (u) =>
            (u.username && u.username === memberName) ||
            (u.displayName && u.displayName === memberName) ||
            (u.username && u.username.toLowerCase() === memberName.toLowerCase())
        );
        if (found && found.id) {
          if (!memberIds.includes(found.id)) memberIds.push(found.id);
        }
      } catch (_e) {
        // ignore one name fail, continue
      }
    }
    try {
      const result = await api("/api/conversations/groups", {
        method: "POST",
        body: JSON.stringify({ name, memberIds, iconName, iconColor })
      });
      closeGroupModal();
      loadGroups();
      switchSidebarTab("groups");
      if (result.group) {
        selectGroup({
          conversationId: result.group.id,
          name: result.group.name,
          iconName: result.group.iconName,
          iconColor: result.group.iconColor,
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
    state.csrfToken = null;
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

// Bootstrap exposure for split modules (api, socket-client, *-ui)
if (typeof window !== "undefined") {
  const w = window;
  w.state = state;
  w.elements = elements;
  w.socket = socket;
  // functions defined in this bootstrap or ui modules
  if (typeof joinChat === "function") w.joinChat = joinChat;
  if (typeof handleIncomingRoomMessage === "function") w.handleIncomingRoomMessage = handleIncomingRoomMessage;
  if (typeof handleIncomingMessage === "function") w.handleIncomingMessage = handleIncomingMessage;
  if (typeof sendCurrentMessage === "function") w.sendCurrentMessage = sendCurrentMessage;
  if (typeof addReaction === "function") w.addReaction = addReaction;
  if (typeof editMessage === "function") w.editMessage = editMessage;
  if (typeof deleteMessage === "function") w.deleteMessage = deleteMessage;
  if (typeof renderReplyPreview === "function") w.renderReplyPreview = renderReplyPreview;
  if (typeof clearReplyTarget === "function") w.clearReplyTarget = clearReplyTarget;
  if (typeof setComposerDisabled === "function") w.setComposerDisabled = setComposerDisabled;
  if (typeof renderConversationHeader === "function") w.renderConversationHeader = renderConversationHeader;
  if (typeof switchSidebarTab === "function") w.switchSidebarTab = switchSidebarTab;
  if (typeof selectConversation === "function") w.selectConversation = selectConversation;
  if (typeof selectGroup === "function") w.selectGroup = selectGroup;
  if (typeof selectPublicRoom === "function") w.selectPublicRoom = selectPublicRoom;
  if (typeof startChatWithOnlineUser === "function") w.startChatWithOnlineUser = startChatWithOnlineUser;
  if (typeof handleMessageSubmit === "function") w.handleMessageSubmit = handleMessageSubmit;
  if (typeof sendTextMessage === "function") w.sendTextMessage = sendTextMessage;
  if (typeof sendFileMessage === "function") w.sendFileMessage = sendFileMessage;
  if (typeof runMessageSearch === "function") w.runMessageSearch = runMessageSearch;
  if (typeof searchUsersDebounced === "function") w.searchUsersDebounced = searchUsersDebounced;
  if (typeof renderSidebar === "function") w.renderSidebar = renderSidebar;
  if (typeof renderConversationList === "function") w.renderConversationList = renderConversationList;
  if (typeof openChatPanel === "function") w.openChatPanel = openChatPanel;
  if (typeof loadGroups === "function") w.loadGroups = loadGroups;
  if (typeof setConnectionVisible === "function") w.setConnectionVisible = setConnectionVisible;
  if (typeof renderSelectedFilePreview === "function") w.renderSelectedFilePreview = renderSelectedFilePreview;
  if (typeof clearSelectedFile === "function") w.clearSelectedFile = clearSelectedFile;
  if (typeof updateAdminLink === "function") w.updateAdminLink = updateAdminLink;
  if (typeof selectAiSession === "function") w.selectAiSession = selectAiSession;

  // setup cross module listeners
  if (typeof w.setupSocketListeners === "function") {
    try { w.setupSocketListeners(); } catch (_) {}
  }
}