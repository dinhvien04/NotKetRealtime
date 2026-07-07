const onlineBySocket = new Map();
const socketByUserId = new Map();

function addPresence(socketId, user) {
  const existingSocketId = socketByUserId.get(user.id);
  if (existingSocketId) {
    onlineBySocket.delete(existingSocketId);
  }

  const presence = {
    id: user.id,
    socketId,
    username: user.username,
    displayName: user.displayName || user.username
  };

  onlineBySocket.set(socketId, presence);
  socketByUserId.set(user.id, socketId);
  return { ...presence };
}

function removePresence(socketId) {
  const presence = onlineBySocket.get(socketId);
  if (!presence) return null;
  onlineBySocket.delete(socketId);
  if (socketByUserId.get(presence.id) === socketId) {
    socketByUserId.delete(presence.id);
  }
  return { ...presence };
}

function getPresenceBySocket(socketId) {
  const presence = onlineBySocket.get(socketId);
  return presence ? { ...presence } : null;
}

function getPresenceByUserId(userId) {
  const socketId = socketByUserId.get(userId);
  if (!socketId) return null;
  return getPresenceBySocket(socketId);
}

function getAllOnline() {
  return Array.from(onlineBySocket.values(), (item) => ({ ...item }));
}

function isOnline(userId) {
  return socketByUserId.has(userId);
}

module.exports = {
  addPresence,
  removePresence,
  getPresenceBySocket,
  getPresenceByUserId,
  getAllOnline,
  isOnline
};