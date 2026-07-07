const path = require("path");
const FileType = require("file-type");
const { isAllowedMimeType } = require("./mime");

const BLOCKED_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".svg",
  ".js",
  ".mjs",
  ".cjs",
  ".exe",
  ".sh",
  ".bat",
  ".cmd",
  ".php",
  ".zip"
]);

const OFFICE_MIME_TYPES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
]);

const MIME_EXTENSION_MAP = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav"
};

const AUDIO_MIME_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/wav"
]);

function hasBlockedExtension(fileName) {
  const extension = path.extname(String(fileName || "")).toLowerCase();
  return BLOCKED_EXTENSIONS.has(extension);
}

function isSafePlainText(buffer) {
  if (!buffer || buffer.length === 0) {
    return false;
  }
  if (buffer.includes(0)) {
    return false;
  }
  const text = buffer.toString("utf8");
  return Buffer.from(text, "utf8").equals(buffer);
}

function mimeTypesMatch(declaredMimeType, detectedMime) {
  if (detectedMime === declaredMimeType) {
    return true;
  }

  if (
    detectedMime === "application/zip" &&
    OFFICE_MIME_TYPES.has(declaredMimeType)
  ) {
    return true;
  }

  if (
    declaredMimeType === "application/msword" &&
    (detectedMime === "application/x-cfb" ||
      detectedMime === "application/msword")
  ) {
    return true;
  }

  return false;
}

async function validateUploadedFile({ buffer, declaredMimeType, originalName }) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("File không hợp lệ.");
  }

  if (hasBlockedExtension(originalName)) {
    throw new Error("Loại file không được hỗ trợ.");
  }

  if (!isAllowedMimeType(declaredMimeType)) {
    throw new Error("Loại file không được hỗ trợ.");
  }

  if (declaredMimeType === "text/plain") {
    if (!isSafePlainText(buffer)) {
      throw new Error("Nội dung file text không hợp lệ.");
    }
    return declaredMimeType;
  }

  if (AUDIO_MIME_TYPES.has(declaredMimeType)) {
    let detected;
    try {
      detected = await FileType.fromBuffer(buffer);
    } catch (_error) {
      throw new Error("Không thể xác định loại file từ nội dung.");
    }

    if (!detected) {
      throw new Error("Không thể xác định loại file từ nội dung.");
    }

    const detectedMime = detected.mime;
    const audioMatch =
      detectedMime === declaredMimeType ||
      (declaredMimeType === "audio/webm" &&
        (detectedMime === "audio/webm" || detectedMime === "video/webm")) ||
      (declaredMimeType === "audio/ogg" && detectedMime === "audio/ogg") ||
      (declaredMimeType === "audio/mpeg" && detectedMime === "audio/mpeg") ||
      (declaredMimeType === "audio/wav" && detectedMime === "audio/wav");

    if (!audioMatch) {
      throw new Error("Nội dung file không khớp với loại MIME đã khai báo.");
    }

    return declaredMimeType;
  }

  let detected;
  try {
    detected = await FileType.fromBuffer(buffer);
  } catch (_error) {
    throw new Error("Không thể xác định loại file từ nội dung.");
  }

  if (!detected) {
    throw new Error("Không thể xác định loại file từ nội dung.");
  }

  if (!mimeTypesMatch(declaredMimeType, detected.mime)) {
    throw new Error("Nội dung file không khớp với loại MIME đã khai báo.");
  }

  if (!isAllowedMimeType(detected.mime) && !OFFICE_MIME_TYPES.has(declaredMimeType)) {
    throw new Error("Loại file không được hỗ trợ.");
  }

  return declaredMimeType;
}

function extensionFromMimeType(mimeType) {
  return MIME_EXTENSION_MAP[mimeType] || "bin";
}

module.exports = {
  BLOCKED_EXTENSIONS,
  hasBlockedExtension,
  validateUploadedFile,
  extensionFromMimeType,
  isSafePlainText,
  mimeTypesMatch
};