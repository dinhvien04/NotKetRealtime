const path = require("path");

function sanitizeFileName(fileName) {
  if (typeof fileName !== "string") {
    return "file";
  }

  const baseName = path.basename(fileName).replace(/[\u0000-\u001F\u007F<>:"/\\|?*]/g, "");
  const trimmed = baseName.trim().replace(/\s+/g, "_");
  return trimmed.slice(0, 120) || "file";
}

function sanitizeSenderId(senderId) {
  if (typeof senderId !== "string") {
    return "unknown";
  }

  const cleaned = senderId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return cleaned || "unknown";
}

module.exports = {
  sanitizeFileName,
  sanitizeSenderId
};