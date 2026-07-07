const PENDING_TTL_MS = 5 * 60 * 1000;
const pendingUploads = new Map();

function getKey(senderId, fileKey) {
  return `${senderId}::${fileKey}`;
}

function addPendingUpload(senderId, fileMeta) {
  cleanupExpiredUploads();
  const key = getKey(senderId, fileMeta.fileKey);
  pendingUploads.set(key, {
    ...fileMeta,
    senderId,
    expiresAt: Date.now() + PENDING_TTL_MS
  });
}

function consumePendingUpload(senderId, fileKey) {
  cleanupExpiredUploads();
  const key = getKey(senderId, fileKey);
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
  consumePendingUpload,
  cleanupExpiredUploads
};