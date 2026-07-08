const config = require("../config/env");

const pendingUploads = new Map();

function getPendingTtlMs() {
  const presignedMs = config.s3PresignedUploadTtlSeconds * 1000;
  const tenMin = 10 * 60 * 1000;
  return Math.max(tenMin, presignedMs + 60 * 1000);
}

function getKey(userId, fileKey) {
  return `${userId}::${fileKey}`;
}

function addPendingUpload(userId, fileMeta) {
  cleanupExpiredUploads();
  const key = getKey(userId, fileMeta.fileKey);
  pendingUploads.set(key, {
    ...fileMeta,
    userId,
    status: fileMeta.status || "signed",
    expiresAt: Date.now() + getPendingTtlMs()
  });
}

function getPendingUpload(userId, fileKey) {
  cleanupExpiredUploads();
  const key = getKey(userId, fileKey);
  const pending = pendingUploads.get(key);
  if (!pending) {
    return null;
  }
  return { ...pending };
}

function markPendingUploadUploaded(userId, fileKey) {
  cleanupExpiredUploads();
  const key = getKey(userId, fileKey);
  const pending = pendingUploads.get(key);
  if (!pending) {
    return false;
  }
  pending.status = "uploaded";
  pendingUploads.set(key, pending);
  return true;
}

function consumePendingUpload(userId, fileKey) {
  cleanupExpiredUploads();
  const key = getKey(userId, fileKey);
  const pending = pendingUploads.get(key);
  if (!pending) {
    return null;
  }

  pendingUploads.delete(key);
  return { ...pending };
}

function cleanupExpiredUploads() {
  const now = Date.now();
  for (const [key, value] of pendingUploads.entries()) {
    if (value.expiresAt <= now) {
      pendingUploads.delete(key);
    }
  }
}

module.exports = {
  addPendingUpload,
  getPendingUpload,
  markPendingUploadUploaded,
  consumePendingUpload,
  cleanupExpiredUploads,
  getPendingTtlMs
};