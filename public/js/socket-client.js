// socket-client.js - socket wiring and ack helper
function emitSocketAck(eventName, payload) {
  return new Promise((resolve) => {
    if (window.socket) {
      window.socket.emit(eventName, payload, resolve);
    } else {
      resolve({ ok: false, error: "no socket" });
    }
  });
}

function setupSocketListeners() {
  if (!window.socket) return;
  const socket = window.socket;

  socket.on("connect", () => {
    if (window.state && window.state.currentUser && !window.state.hasJoined) {
      if (typeof window.joinChat === "function") window.joinChat();
    }
    if (window.hideConnectionOverlay) window.hideConnectionOverlay();
  });

  socket.on("disconnect", () => {
    if (window.showConnectionOverlay) window.showConnectionOverlay();
  });

  socket.on("online_users", (users) => {
    if (window.state) window.state.onlineUsers = Array.isArray(users) ? users : [];
    if (typeof window.renderSidebar === "function") window.renderSidebar();
  });

  socket.on("private_message", (message) => {
    if (typeof window.handleIncomingRoomMessage === "function") window.handleIncomingRoomMessage(message, "direct");
    else if (typeof window.appendMessage === "function") window.appendMessage(message);
  });
  socket.on("public_message", (message) => {
    if (typeof window.handleIncomingRoomMessage === "function") window.handleIncomingRoomMessage(message, "public");
    else if (typeof window.appendMessage === "function") window.appendMessage(message);
  });
  socket.on("group_message", (message) => {
    if (typeof window.handleIncomingRoomMessage === "function") window.handleIncomingRoomMessage(message, "group");
    else if (typeof window.appendMessage === "function") window.appendMessage(message);
  });

  socket.on("typing", (p) => { if (typeof window.showTyping === "function") window.showTyping(p); });
  socket.on("stop_typing", (p) => { if (typeof window.hideTyping === "function") window.hideTyping(p); });

  socket.on("message_edited", (m) => { if (typeof window.updateMessageRow === "function") window.updateMessageRow(m); });
  socket.on("message_deleted", (p) => { if (typeof window.markMessageDeleted === "function") window.markMessageDeleted(p); });
  socket.on("message_reaction_added", (r) => { if (typeof window.applyReaction === "function") window.applyReaction(r); });
  socket.on("message_reaction_removed", (r) => { if (typeof window.applyReaction === "function") window.applyReaction(r, true); });
  socket.on("message_read", (r) => { if (typeof window.updateReadReceipt === "function") window.updateReadReceipt(r); });
}

if (typeof window !== "undefined") {
  window.emitSocketAck = emitSocketAck;
  window.setupSocketListeners = setupSocketListeners;
}
