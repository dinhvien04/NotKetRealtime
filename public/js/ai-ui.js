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
    const res = await apiFn("/api/ai/sessions");
    if (window.state) window.state.aiSessions = res.sessions || [];
    if (typeof window.renderAiSessions === "function") window.renderAiSessions();
  } catch (e) { /* ignore */ }
}

function renderAiSessions() {
  const list = window.elements && window.elements.aiSessionList;
  const st = window.state || {};
  if (!list) return;
  list.replaceChildren();
  (st.aiSessions || []).forEach((s) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "user-item" + (s.id === st.aiSessionId ? " is-active" : "");
    b.textContent = s.title || "AI";
    b.addEventListener("click", () => {
      if (typeof window.selectAiSession === "function") window.selectAiSession(s.id);
    });
    list.append(b);
  });
}

async function selectAiSession(id) {
  const st = window.state || {};
  st.chatMode = "ai";
  st.aiSessionId = id;
  st.selectedConversationId = null;
  st.selectedUser = null;
  if (typeof window.clearMessages === "function") window.clearMessages();
  if (typeof window.openChatPanel === "function") window.openChatPanel();
  if (typeof window.renderConversationHeader === "function") window.renderConversationHeader();
  if (typeof window.renderSidebar === "function") window.renderSidebar();
  try {
    const apiFn = window.api || (async () => ({}));
    const res = await apiFn(`/api/ai/sessions/${id}/messages`);
    (res.messages || []).forEach(m => appendAiMessage(m));
  } catch (e) { /* */ }
}

async function createAiSession() {
  try {
    const apiFn = window.api || (async () => ({}));
    const res = await apiFn("/api/ai/sessions", { method: "POST", body: JSON.stringify({ title: "Cuộc trò chuyện AI" }) });
    if (window.state) {
      (window.state.aiSessions = window.state.aiSessions || []).unshift(res.session);
    }
    if (typeof window.switchSidebarTab === "function") window.switchSidebarTab("ai");
    if (res.session) await selectAiSession(res.session.id);
  } catch (error) {
    if (typeof window.showToast === "function") window.showToast(error.message, "error");
  }
}

if (typeof window !== "undefined") {
  window.appendAiMessage = appendAiMessage;
  window.showAiLoadingBubble = showAiLoadingBubble;
  window.loadAiSessions = loadAiSessions;
  window.renderAiSessions = renderAiSessions;
  window.selectAiSession = selectAiSession;
  window.createAiSession = createAiSession;
}
