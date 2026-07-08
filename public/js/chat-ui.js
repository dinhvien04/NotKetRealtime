// chat-ui.js - chat rendering, messages, typing, search, sidebar etc.
const DELETED_LABEL = "Tin nhắn đã bị xóa";
const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;
window.DELETED_LABEL = DELETED_LABEL;
window.MESSAGE_EDIT_WINDOW_MS = MESSAGE_EDIT_WINDOW_MS;

function showToast(message, type = "info") {
  const region = (window.elements && window.elements.toastRegion) ? window.elements.toastRegion : null;
  if (!region) { console.log("[toast]", message); return; }
  const el = document.createElement("div");
  el.className = `toast ${type === "error" ? "toast-error" : ""}`;
  el.textContent = message;
  region.append(el);
  setTimeout(() => el.remove(), 3200);
}

function hideConnectionOverlay() {
  const ov = window.elements && window.elements.connectionOverlay;
  if (ov) ov.classList.add("is-hidden");
}
function showConnectionOverlay() {
  const ov = window.elements && window.elements.connectionOverlay;
  if (ov) ov.classList.remove("is-hidden");
}

function showTyping(payload) {
  const st = window.elements && window.elements.typingStatus;
  const txt = window.elements && window.elements.typingText;
  if (!st || !txt) return;
  const name = payload.senderName || "Ai đó";
  txt.textContent = `${name} đang nhập...`;
  st.classList.remove("is-hidden");
}
function hideTyping() {
  const st = window.elements && window.elements.typingStatus;
  if (st) st.classList.add("is-hidden");
}

function getMessagePreview(message) {
  if (message.type === "image") return "📷 Ảnh";
  if (message.type === "voice") return "🎙️ Tin thoại";
  if (message.type === "file") return message.fileName || "📄 File";
  return (message.message || message.body || "").slice(0, 60);
}

function getMessageBody(message) {
  return message.message || message.body || message.text || "";
}

function createDaySeparator(date = new Date()) {
  const sep = document.createElement("div");
  sep.className = "day-separator";
  sep.textContent = date.toLocaleDateString("vi-VN");
  return sep;
}

function trackMessageRow(message, row, { prepend = false } = {}) {
  const st = window.state || {};
  if (st.loadedMessageIds && st.loadedMessageIds.has(message.id)) return false;
  if (st.loadedMessageIds) st.loadedMessageIds.add(message.id);
  if (st.messageRows) st.messageRows.set(message.id, row);
  const msgs = (window.elements && window.elements.messages) || null;
  if (msgs) {
    if (prepend) msgs.prepend(row);
    else msgs.append(row);
  }
  return true;
}

function appendMessage(message) {
  const st = window.state || {};
  if (st.loadedMessageIds && st.loadedMessageIds.has(message.id)) {
    if (typeof window.updateMessageRow === "function") window.updateMessageRow(message);
    return;
  }
  const row = (typeof window.createMessageRow === "function") ? window.createMessageRow(message) : document.createElement("article");
  trackMessageRow(message, row);
  const msgs = window.elements && window.elements.messages;
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function prependMessages(messages = []) {
  const list = [...messages].reverse();
  for (const m of list) {
    if (window.state && window.state.loadedMessageIds && window.state.loadedMessageIds.has(m.id)) continue;
    const row = (typeof window.createMessageRow === "function") ? window.createMessageRow(m) : document.createElement("div");
    trackMessageRow(m, row, { prepend: true });
  }
}

function appendSystemMessage(text) {
  const msgs = window.elements && window.elements.messages;
  if (!msgs) return;
  const row = document.createElement("div");
  row.className = "system-message";
  row.textContent = text;
  msgs.append(row);
  msgs.scrollTop = msgs.scrollHeight;
}

function updateMessageRow(message) {
  const row = (window.state && window.state.messageRows) ? window.state.messageRows.get(message.id) : null;
  if (!row) return;
  const bubble = row.querySelector(".message-bubble");
  const reactions = row.querySelector(".message-reactions");
  const actions = row.querySelector(".message-actions");
  if (bubble && typeof window.fillMessageBubble === "function") window.fillMessageBubble(bubble, message);
  if (reactions && typeof window.renderReactionChips === "function") window.renderReactionChips(reactions, message);
  if (actions) actions.replaceWith((typeof window.createMessageActions === "function") ? window.createMessageActions(message) : actions);
}

function markMessageDeleted(payload) {
  const row = (window.state && window.state.messageRows) ? window.state.messageRows.get(payload.messageId) : null;
  if (!row) return;
  const bubble = row.querySelector(".message-bubble");
  if (bubble) {
    bubble.textContent = DELETED_LABEL;
    bubble.classList.add("deleted");
  }
}

function applyReaction(reaction, remove = false) {
  // minimal: re-render if row present
  const row = (window.state && window.state.messageRows) ? window.state.messageRows.get(reaction.messageId) : null;
  if (!row) return;
  if (typeof window.updateMessageRow === "function") window.updateMessageRow({ id: reaction.messageId });
}

function updateReadReceipt(info) {
  // no-op or badge update if needed
}

function normalizeReactionForClient(reaction) {
  const reactionType = reaction.type || reaction.reactionType || (reaction.iconName ? "icon" : "emoji");
  const value = reaction.value || reaction.emoji || reaction.iconName;
  return {
    ...reaction,
    reactionType,
    value,
    color: (window.normalizeHexColor ? window.normalizeHexColor(reaction.color || reaction.iconColor) : null)
  };
}

function renderReactionChips(container, message) {
  if (!container) return;
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
    if (!grouped.has(key)) grouped.set(key, { ...reaction, count: 0 });
    grouped.get(key).count += 1;
  }
  for (const item of grouped.values()) {
    const chip = document.createElement("span");
    chip.className = "reaction-chip";
    if (item.reactionType === "icon" && window.createIconElement) {
      const ic = window.createIconElement(item.value, item.color, "reaction-icon");
      if (ic) chip.append(ic);
    } else {
      chip.textContent = item.value;
    }
    const cnt = document.createElement("small");
    cnt.textContent = ` ${item.count}`;
    chip.append(cnt);
    chip.addEventListener("click", () => {
      if (typeof window.addReaction === "function") window.addReaction(message.id, item.reactionType, item.value, item.color);
    });
    container.append(chip);
  }
}

function fillMessageBubble(bubble, message) {
  bubble.replaceChildren();
  bubble.className = `message-bubble${message.type === "image" ? " message-bubble-image" : ""}${message.type === "file" ? " message-bubble-file" : ""}${message.type === "voice" ? " message-bubble-voice" : ""}`;
  if (message.deleted_at || message.deletedAt) {
    bubble.textContent = DELETED_LABEL;
    bubble.classList.add("deleted");
    return;
  }
  if (message.type === "image" || message.type === "file" || message.type === "voice") {
    if (message.type === "image") {
      const img = document.createElement("img");
      img.src = message.fileUrl || "";
      img.alt = message.fileName || "image";
      img.addEventListener("click", () => window.open(message.fileUrl, "_blank"));
      bubble.append(img);
    } else if (message.type === "voice") {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = message.fileUrl || "";
      bubble.append(audio);
    } else {
      const card = document.createElement("div");
      card.className = "message-file-card";
      const name = document.createElement("span");
      name.textContent = message.fileName || "file";
      const link = document.createElement("a");
      link.href = message.fileUrl || "#";
      link.target = "_blank";
      link.textContent = "Tải";
      card.append(name, link);
      bubble.append(card);
    }
    if (message.replyToMessageId) {
      const rp = document.createElement("div");
      rp.className = "reply-ref";
      rp.textContent = "↩ reply";
      bubble.append(rp);
    }
    return;
  }
  const text = document.createElement("span");
  text.textContent = getMessageBody(message);
  bubble.append(text);
  if (message.replyToMessageId) {
    const rp = document.createElement("div");
    rp.className = "reply-ref";
    rp.textContent = "↩ reply";
    bubble.append(rp);
  }
}

function createMessageRow(message) {
  const row = document.createElement("article");
  row.className = `message-row${message.senderId === (window.state && window.state.currentUser && window.state.currentUser.id) ? " is-own" : ""}`;
  row.dataset.messageId = message.id;
  const bubble = document.createElement("div");
  fillMessageBubble(bubble, message);
  const meta = document.createElement("span");
  meta.className = "message-meta";
  const time = message.createdAt ? new Date(message.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "";
  meta.textContent = `${message.senderName || "User"} • ${time}`;
  const reactions = document.createElement("div");
  reactions.className = "message-reactions is-hidden";
  renderReactionChips(reactions, message);
  const actions = (typeof window.createMessageActions === "function") ? window.createMessageActions(message) : document.createElement("div");
  row.append(bubble, meta, reactions, actions);
  // double click edit etc if own
  row.addEventListener("dblclick", () => {
    if (message.senderId === (window.state && window.state.currentUser && window.state.currentUser.id) && typeof window.editMessage === "function") {
      window.editMessage(message);
    }
  });
  return row;
}

function createMessageActions(message) {
  const wrap = document.createElement("div");
  wrap.className = "message-actions";
  const now = Date.now();
  const created = message.createdAt ? new Date(message.createdAt).getTime() : 0;
  const canEdit = message.senderId === (window.state && window.state.currentUser && window.state.currentUser.id) && (now - created) < MESSAGE_EDIT_WINDOW_MS && !message.deleted_at;
  if (canEdit) {
    const eb = document.createElement("button");
    eb.textContent = "Sửa";
    eb.addEventListener("click", () => { if (typeof window.editMessage === "function") window.editMessage(message); });
    wrap.append(eb);
    const db = document.createElement("button");
    db.textContent = "Xóa";
    db.addEventListener("click", () => { if (typeof window.deleteMessage === "function") window.deleteMessage(message.id); });
    wrap.append(db);
  }
  const rb = document.createElement("button");
  rb.textContent = "↩";
  rb.addEventListener("click", () => { if (window.state) window.state.replyTo = message; if (typeof window.renderReplyPreview === "function") window.renderReplyPreview(); });
  wrap.append(rb);
  const react = document.createElement("button");
  react.textContent = "😊";
  react.addEventListener("click", () => { if (typeof window.openReactionPicker === "function") window.openReactionPicker(message.id); });
  wrap.append(react);
  return wrap;
}

function renderSearchResults(messages = []) {
  const el = window.elements && window.elements.searchResults;
  if (!el) return;
  el.replaceChildren();
  if (!messages.length) {
    const p = document.createElement("p");
    p.textContent = "Không tìm thấy tin nhắn.";
    el.append(p);
    el.classList.remove("is-hidden");
    return;
  }
  for (const message of messages) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-result-item";
    button.textContent = `${message.senderName}: ${getMessagePreview(message)}`;
    button.addEventListener("click", async () => {
      el.classList.add("is-hidden");
      const row = (window.state && window.state.messageRows) ? window.state.messageRows.get(message.id) : null;
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.classList.add("is-highlighted");
        setTimeout(() => row.classList.remove("is-highlighted"), 2000);
        return;
      }
      showToast("Tin nhắn nằm ngoài phần đã tải.");
      if (window.state && window.state.selectedConversationId && typeof window.loadMessages === "function") {
        try { window.loadMessages({ reset: true }); } catch (_) {}
      }
    });
    el.append(button);
  }
  el.classList.remove("is-hidden");
}

function hideSearchResults() {
  const el = window.elements && window.elements.searchResults;
  if (el) {
    el.classList.add("is-hidden");
    el.replaceChildren();
  }
}

function renderSidebar() {
  // basic stub, full impl in bootstrap or later
  const st = window.state || {};
  if (typeof window.renderConversationList === "function") window.renderConversationList();
}

function clearMessages() {
  const st = window.state || {};
  if (st.loadedMessageIds) st.loadedMessageIds.clear();
  if (st.messageRows) st.messageRows.clear();
  const msgs = window.elements && window.elements.messages;
  if (msgs) msgs.replaceChildren(createDaySeparator());
}

function loadMessages({ reset = false } = {}) {
  if (!window.socket || !window.state || !window.state.selectedConversationId) return;
  window.state.isLoadingOlder = !reset;
  window.socket.emit("load_messages", {
    conversationId: window.state.selectedConversationId,
    limit: 30,
    cursor: reset ? null : (window.state.nextCursor || null)
  }, (response) => {
    window.state.isLoadingOlder = false;
    if (!response || !response.ok) {
      appendSystemMessage(response && response.error || "Không thể tải tin nhắn.");
      return;
    }
    if (reset) clearMessages();
    const msgs = response.messages || [];
    if (reset) msgs.forEach(m => appendMessage(m));
    else prependMessages(msgs);
    window.state.nextCursor = response.nextCursor;
    window.state.hasMoreMessages = !!response.hasMore;
    if (response.otherUser) window.state.selectedUser = response.otherUser;
  });
}

if (typeof window !== "undefined") {
  window.showToast = showToast;
  window.hideConnectionOverlay = hideConnectionOverlay;
  window.showConnectionOverlay = showConnectionOverlay;
  window.showTyping = showTyping;
  window.hideTyping = hideTyping;
  window.appendMessage = appendMessage;
  window.prependMessages = prependMessages;
  window.appendSystemMessage = appendSystemMessage;
  window.updateMessageRow = updateMessageRow;
  window.markMessageDeleted = markMessageDeleted;
  window.applyReaction = applyReaction;
  window.renderReactionChips = renderReactionChips;
  window.fillMessageBubble = fillMessageBubble;
  window.createMessageRow = createMessageRow;
  window.createMessageActions = createMessageActions;
  window.renderSearchResults = renderSearchResults;
  window.hideSearchResults = hideSearchResults;
  window.clearMessages = clearMessages;
  window.loadMessages = loadMessages;
  window.getMessagePreview = getMessagePreview;
  window.getMessageBody = getMessageBody;
}
