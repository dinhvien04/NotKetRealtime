const MAX_USERNAME_LENGTH = 40;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_DISPLAY_NAME_LENGTH = 80;
const MAX_BIO_LENGTH = 280;

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

function sanitizeDisplayName(value) {
  return sanitizeText(value, MAX_DISPLAY_NAME_LENGTH).replace(/\s+/g, " ");
}

function sanitizeBio(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return sanitizeText(String(value), MAX_BIO_LENGTH);
}

module.exports = {
  sanitizeUsername,
  sanitizeMessage,
  sanitizeDisplayName,
  sanitizeBio
};
