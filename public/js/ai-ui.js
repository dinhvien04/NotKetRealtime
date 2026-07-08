// ai-ui.js - AI sessions and UX
function appendAiMessage(message) {
  const msgs = window.elements && window.elements.messages;
  if (!msgs) return;
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
  msgs.append(row);
  msgs.scrollTop = msgs.scrollHeight;
}

function showAiLoadingBubble() {
  const msgs = window.elements && window.elements.messages;
  if (!msgs) return null;
  const row = document.createElement("article");
  row.className = "message-row ai-loading";
  const bubble = document.createElement("div");
  bubble.className = "message-bubble is-loading";
  bubble.textContent = "AI đang trả lời...";
  const meta = document.createElement("span");
  meta.className = "message-meta";
  meta.textContent = "AI Bot";
  row.append(bubble, meta);
  msgs.append(row);
  msgs.scrollTop = msgs.scrollHeight;
  return row;
}

async function loadAiSessions() {
  try {
    const apiFn = window.api || (async () => ({ sessions: [] }));
    const result = await apiFn("/api/ai/sessions");
    if (window.state) window.state.aiSessions = result.sessions || [];
    if (typeof window.renderAiSessions === "function") window.renderAiSessions();
  } catch (error) {
    if (typeof window.showToast === "function") window.showToast(error.message, "error");
  }
}

function renderAiSessions() {
  const els = window.elements || {};
  const st = window.state || {};
  if (!els.aiSessionList) return;
  els.aiSessionList.replaceChildren();
  for (const session of (st.aiSessions || [])) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "user-item";
    if (st.chatMode === "ai" && st.aiSessionId === session.id) {
      button.classList.add("is-active");
    }
    const avatar = document.createElement("span");
    avatar.className = "avatar";
    if (window.setAvatar) {
      window.setAvatar(avatar, "AI");
    } else {
      avatar.textContent = "AI";
    }
    const copy = document.createElement("span");
    copy.className = "user-copy";
    const name = document.createElement("strong");
    name.textContent = session.title || "Cuộc trò chuyện AI";
    copy.append(name);
    button.append(avatar, copy);
    button.addEventListener("click", () => {
      if (typeof window.selectAiSession === "function") window.selectAiSession(session.id);
    });
    els.aiSessionList.append(button);
  }
}

async function selectAiSession(sessionId) {
  const st = window.state || {};
  const els = window.elements || {};
  st.chatMode = "ai";
  st.aiSessionId = sessionId;
  st.selectedUser = null;
  st.selectedConversationId = null;
  if (window.clearSelectedFile) window.clearSelectedFile();
  if (window.hideSearchResults) window.hideSearchResults();
  if (window.openChatPanel) window.openChatPanel();
  if (els.selectedUsername) els.selectedUsername.textContent = "AI Bot";
  if (window.setAvatar && els.selectedAvatar) window.setAvatar(els.selectedAvatar, "AI");
  if (els.selectedStatus && els.selectedStatus.lastChild) {
    els.selectedStatus.lastChild.textContent = "Trợ lý AI";
  }
  if (els.conversationTypeChip) els.conversationTypeChip.textContent = "AI";
  if (els.groupMembersButton) els.groupMembersButton.classList.add("is-hidden");
  if (els.leaveGroupButton) els.leaveGroupButton.classList.add("is-hidden");
  if (els.attachButton) els.attachButton.disabled = true;
  if (els.recordButton) els.recordButton.disabled = true;
  if (window.clearMessages) window.clearMessages();
  if (typeof window.renderAiSessions === "function") window.renderAiSessions();
  try {
    const apiFn = window.api || (async () => ({}));
    const result = await apiFn(`/api/ai/sessions/${sessionId}/messages`);
    for (const message of (result.messages || [])) {
      if (typeof appendAiMessage === "function") appendAiMessage(message);
    }
    if (els.messageInput) els.messageInput.disabled = false;
    if (els.sendButton) els.sendButton.disabled = false;
    if (els.messageInput) els.messageInput.focus();
  } catch (error) {
    if (typeof window.showToast === "function") window.showToast(error.message, "error");
  }
}

async function createAiSession() {
  try {
    const apiFn = window.api || (async () => ({}));
    const result = await apiFn("/api/ai/sessions", {
      method: "POST",
      body: JSON.stringify({ title: "Cuộc trò chuyện AI" })
    });
    if (window.state) {
      (window.state.aiSessions = window.state.aiSessions || []).unshift(result.session);
    }
    if (typeof window.switchSidebarTab === "function") window.switchSidebarTab("ai");
    if (result.session) await selectAiSession(result.session.id);
  } catch (error) {
    if (typeof window.showToast === "function") window.showToast(error.message, "error");
  }
}

async function sendAiMessage(text) {
  const showLoading = window.showAiLoadingBubble;
  const loadingRow = showLoading ? showLoading() : null;
  try {
    const apiFn = window.api || (async () => ({}));
    const apiCall = apiFn(`/api/ai/sessions/${(window.state || {}).aiSessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: text })
    });
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("AI phản hồi quá lâu. Vui lòng thử lại.")), 25000)
    );
    const result = await Promise.race([apiCall, timeout]);
    if (loadingRow && loadingRow.parentNode) loadingRow.parentNode.removeChild(loadingRow);
    const appendFn = window.appendAiMessage;
    if (result.userMessage && appendFn) appendFn(result.userMessage);
    if (result.assistantMessage && appendFn) appendFn(result.assistantMessage);
    if (typeof window.loadAiSessions === "function") window.loadAiSessions();
  } catch (error) {
    if (loadingRow && loadingRow.parentNode) loadingRow.parentNode.removeChild(loadingRow);
    const isTimeout = /quá lâu|timeout/i.test(error.message || "");
    if (typeof window.showToast === "function") {
      window.showToast(isTimeout ? "AI phản hồi quá lâu. Vui lòng thử lại." : (error.message || "Lỗi khi gọi AI."), "error");
    }
    throw error;
  }
}

if (typeof window !== "undefined") {
  window.appendAiMessage = appendAiMessage;
  window.showAiLoadingBubble = showAiLoadingBubble;
  window.loadAiSessions = loadAiSessions;
  window.renderAiSessions = renderAiSessions;
  window.selectAiSession = selectAiSession;
  window.createAiSession = createAiSession;
  window.sendAiMessage = sendAiMessage;
}
