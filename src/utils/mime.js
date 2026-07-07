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
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/wav"
]);

const VOICE_MIME_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/wav"
]);

function isAllowedMimeType(mimeType) {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

function isVoiceMimeType(mimeType) {
  return VOICE_MIME_TYPES.has(mimeType);
}

function getKindFromMimeType(mimeType, explicitKind = null) {
  if (explicitKind === "voice" || explicitKind === "image" || explicitKind === "file") {
    return explicitKind;
  }
  if (mimeType?.startsWith("image/")) return "image";
  if (isVoiceMimeType(mimeType)) return "voice";
  return "file";
}

function getMaxBytesForKind(kind) {
  const config = require("../config/env");
  if (kind === "image") return config.maxImageBytes;
  if (kind === "voice") return config.maxVoiceBytes;
  return config.maxUploadBytes;
}

module.exports = {
  ALLOWED_MIME_TYPES,
  VOICE_MIME_TYPES,
  isAllowedMimeType,
  isVoiceMimeType,
  getKindFromMimeType,
  getMaxBytesForKind
};