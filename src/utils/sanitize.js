const MAX_USERNAME_LENGTH = 40;
const MAX_MESSAGE_LENGTH = 2000;

function sanitizeText(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

function sanitizeUsername(value) {
  return sanitizeText(value, MAX_USERNAME_LENGTH).replace(/\s+/g, " ");
}

function sanitizeMessage(value) {
  return sanitizeText(value, MAX_MESSAGE_LENGTH);
}

module.exports = {
  sanitizeUsername,
  sanitizeMessage
};
