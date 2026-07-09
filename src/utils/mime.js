const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
]);

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

function isAllowedMimeType(mimeType) {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

function isImageMimeType(mimeType) {
  return IMAGE_MIME_TYPES.has(mimeType);
}

function getKindFromMimeType(mimeType, explicitKind = null) {
  if (explicitKind === "image" || explicitKind === "file") {
    return explicitKind;
  }
  if (mimeType?.startsWith("image/")) return "image";
  return "file";
}

function getMaxBytesForKind(kind) {
  const config = require("../config/env");
  if (kind === "image") return config.maxImageBytes;
  return config.maxFileBytes || config.maxUploadBytes;
}

module.exports = {
  ALLOWED_MIME_TYPES,
  IMAGE_MIME_TYPES,
  isAllowedMimeType,
  isImageMimeType,
  getKindFromMimeType,
  getMaxBytesForKind
};
