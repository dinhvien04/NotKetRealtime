const { randomUUID } = require("crypto");
const { getCurrentTime } = require("../utils/time");

const messages = [];
const MAX_MESSAGES = 1000;

function createMessage(senderId, receiverId, senderName, message) {
  const newMessage = {
    id: randomUUID(),
    senderId,
    receiverId,
    senderName,
    message,
    time: getCurrentTime()
  };

  messages.push(newMessage);
  if (messages.length > MAX_MESSAGES) {
    messages.splice(0, messages.length - MAX_MESSAGES);
  }

  return { ...newMessage };
}

function getMessagesBetweenUsers(userA, userB) {
  return messages
    .filter(
      (message) =>
        (message.senderId === userA && message.receiverId === userB) ||
        (message.senderId === userB && message.receiverId === userA)
    )
    .map((message) => ({ ...message }));
}

module.exports = {
  createMessage,
  getMessagesBetweenUsers
};
