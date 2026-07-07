const conversationRepository = require("../repositories/conversation.repository");

let ioInstance = null;

function setIo(io) {
  ioInstance = io;
}

function getIo() {
  return ioInstance;
}

async function emitToConversation(conversationId, eventName, payload) {
  if (!ioInstance) return;

  const participantIds = await conversationRepository.getParticipantIds(
    conversationId
  );
  for (const participantId of participantIds) {
    ioInstance.to(`user:${participantId}`).emit(eventName, payload);
  }
}

module.exports = {
  setIo,
  getIo,
  emitToConversation
};