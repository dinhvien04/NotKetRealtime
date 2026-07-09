const documentMessageRepo = require("../repositories/document-message.repository");
const documentUploadRepo = require("../repositories/document-upload.repository");
const storageService = require("./storage.service");
const config = require("../config/env");

const MAX_TEXT_LENGTH = 5000;

async function enrichMessage(message) {
  if (!message) return null;
  const payload = { ...message };
  if (message.fileKey && (message.type === "image" || message.type === "file")) {
    try {
      payload.fileUrl = await storageService.resolveFileUrl(message.fileKey);
    } catch (_error) {
      payload.fileUrl = null;
    }
  }
  return payload;
}

async function createTextMessage(body) {
  const text = typeof body === "string" ? body.trim() : "";
  if (!text) {
    const error = new Error("Nội dung tin nhắn không được để trống.");
    error.status = 400;
    throw error;
  }
  if (text.length > MAX_TEXT_LENGTH) {
    const error = new Error(`Tin nhắn tối đa ${MAX_TEXT_LENGTH} ký tự.`);
    error.status = 400;
    throw error;
  }

  const message = await documentMessageRepo.createTextMessage({ body: text });
  return enrichMessage(message);
}

async function listMessages(options) {
  const result = await documentMessageRepo.listMessages(options);
  const messages = await Promise.all(result.messages.map(enrichMessage));
  return {
    messages,
    nextCursor: result.nextCursor,
    hasMore: result.hasMore
  };
}

async function softDelete(id) {
  const deleted = await documentMessageRepo.softDelete(id);
  if (!deleted) {
    const error = new Error("Không tìm thấy tin nhắn.");
    error.status = 404;
    throw error;
  }
  return deleted;
}

async function createFileMessage(payload) {
  const {
    fileKey,
    fileName,
    mimeType,
    size,
    kind,
    caption = ""
  } = payload || {};

  if (!fileKey || !fileName || !mimeType || !Number.isFinite(Number(size))) {
    const error = new Error("Metadata file không hợp lệ.");
    error.status = 400;
    throw error;
  }

  const resolvedKind = kind === "image" || mimeType.startsWith("image/") ? "image" : "file";
  if (kind && kind !== "image" && kind !== "file") {
    const error = new Error("kind phải là image hoặc file.");
    error.status = 400;
    throw error;
  }

  await documentUploadRepo.expireOldUploads();

  const pending = await documentUploadRepo.findPendingUpload(fileKey);
  if (!pending || pending.status !== "pending") {
    const error = new Error("Upload không hợp lệ hoặc đã hết hạn.");
    error.status = 400;
    throw error;
  }

  if (new Date(pending.expiresAt).getTime() <= Date.now()) {
    const error = new Error("Upload đã hết hạn.");
    error.status = 400;
    throw error;
  }

  if (
    pending.fileName !== fileName ||
    pending.mimeType !== mimeType ||
    Number(pending.fileSize) !== Number(size) ||
    pending.kind !== resolvedKind
  ) {
    const error = new Error("Metadata không khớp với pending upload.");
    error.status = 400;
    throw error;
  }

  await storageService.verifyUploadedObject({
    fileKey,
    expectedSize: Number(size),
    expectedMimeType: mimeType
  });

  await storageService.verifyUploadedObjectContent({
    fileKey,
    expectedMimeType: mimeType,
    originalName: fileName,
    expectedSize: Number(size)
  });

  // Pending row already reserved this size at sign time; after consume the
  // pending sum drops and committed usage increases by the same amount.
  const used = await documentMessageRepo.getStorageUsage();
  if (used + Number(size) > config.storageLimitBytes) {
    const error = new Error("Đã vượt giới hạn dung lượng lưu trữ.");
    error.status = 400;
    throw error;
  }

  const consumed = await documentUploadRepo.consumePendingUpload(fileKey);
  if (!consumed) {
    const error = new Error("Không thể xác nhận upload (đã dùng hoặc hết hạn).");
    error.status = 400;
    throw error;
  }

  const body =
    typeof caption === "string" && caption.trim()
      ? caption.trim().slice(0, MAX_TEXT_LENGTH)
      : null;

  const message = await documentMessageRepo.createFileMessage({
    type: resolvedKind,
    body,
    fileKey,
    fileName,
    mimeType,
    fileSize: Number(size)
  });

  return enrichMessage(message);
}

async function refreshFileUrl(fileKey) {
  if (!fileKey) {
    const error = new Error("Thiếu fileKey.");
    error.status = 400;
    throw error;
  }

  const existing = await documentMessageRepo.findByFileKey(fileKey);
  if (!existing) {
    const error = new Error("Không tìm thấy file.");
    error.status = 404;
    throw error;
  }

  const fileUrl = await storageService.resolveFileUrl(fileKey);
  return { fileKey, fileUrl };
}

async function getStorageUsage() {
  const usedBytes = await documentMessageRepo.getStorageUsage();
  return {
    usedBytes,
    limitBytes: config.storageLimitBytes
  };
}

/** Scan this many recent URL-ish text messages when building the Links panel. */
const RECENT_TEXT_WITH_LINKS_SCAN = 100;
/** Max distinct links returned to the UI. */
const RECENT_LINKS_UI_MAX = 12;

// Only http(s) and www. — never javascript:, data:, etc.
const URL_IN_TEXT =
  /\b((?:https?:\/\/|www\.)[^\s<>"'`\[\]{}]+)/gi;

// Trailing junk from notes/markdown: ) ] \ . , ; ! ? }
// (escaped ] and \ inside the character class)
const TRAILING_URL_JUNK = /[)\\\].,;!?}]+$/g;

function normalizeUrl(raw) {
  let url = String(raw || "").trim();
  // Strip trailing punctuation / brackets common in notes (repeat until stable)
  let prev;
  do {
    prev = url;
    url = url.replace(TRAILING_URL_JUNK, "");
  } while (url !== prev);
  if (!url) return null;
  if (/^javascript:/i.test(url) || /^data:/i.test(url) || /^vbscript:/i.test(url)) {
    return null;
  }
  if (url.startsWith("www.")) {
    url = `https://${url}`;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch (_error) {
    return null;
  }
}

function extractLinksFromBody(body) {
  if (!body || typeof body !== "string") return [];
  const found = [];
  const seen = new Set();
  let match;
  const re = new RegExp(URL_IN_TEXT.source, URL_IN_TEXT.flags);
  while ((match = re.exec(body)) !== null) {
    const normalized = normalizeUrl(match[1]);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    found.push(normalized);
  }
  return found;
}

function linkDisplayHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (_error) {
    return url;
  }
}

async function getRecentMedia() {
  const [images, files, textWithLinks] = await Promise.all([
    documentMessageRepo.listRecentByType("image", 12),
    documentMessageRepo.listRecentByType("file", 12),
    documentMessageRepo.listRecentTextWithLinks(RECENT_TEXT_WITH_LINKS_SCAN)
  ]);

  const links = [];
  const seenUrl = new Set();
  for (const message of textWithLinks) {
    for (const url of extractLinksFromBody(message.body)) {
      if (seenUrl.has(url)) continue;
      seenUrl.add(url);
      links.push({
        url,
        host: linkDisplayHost(url),
        messageId: message.id,
        body: message.body,
        createdAt: message.createdAt
      });
      if (links.length >= RECENT_LINKS_UI_MAX) break;
    }
    if (links.length >= RECENT_LINKS_UI_MAX) break;
  }

  return {
    images: await Promise.all(images.map(enrichMessage)),
    files: await Promise.all(files.map(enrichMessage)),
    links
  };
}

module.exports = {
  createTextMessage,
  listMessages,
  softDelete,
  createFileMessage,
  refreshFileUrl,
  getStorageUsage,
  getRecentMedia,
  extractLinksFromBody,
  normalizeUrl,
  MAX_TEXT_LENGTH,
  RECENT_TEXT_WITH_LINKS_SCAN,
  RECENT_LINKS_UI_MAX
};
