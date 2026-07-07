const { randomUUID } = require("crypto");
const config = require("../config/env");
const { getSupabaseClient } = require("./supabase.service");
const { getKindFromMimeType, getMaxBytesForKind } = require("../utils/mime");
const {
  validateUploadedFile,
  extensionFromMimeType
} = require("../utils/file-magic");
const { sanitizeFileName, sanitizeSenderId } = require("../utils/filename");

async function resolveFileUrl(fileKey) {
  if (!fileKey) return null;

  const supabase = getSupabaseClient();
  const bucket = config.supabaseStorageBucket;

  if (config.supabaseStoragePublic) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileKey);
    return data.publicUrl;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(fileKey, config.signedUrlTtlSeconds);

  if (error) {
    throw new Error(error.message || "Không thể tạo signed URL.");
  }

  return data.signedUrl;
}

async function uploadChatFile({
  buffer,
  originalName,
  mimeType,
  size,
  senderId,
  kind = null
}) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("File không hợp lệ.");
  }

  if (!size || size <= 0) {
    throw new Error("Kích thước file không hợp lệ.");
  }

  const validatedMimeType = await validateUploadedFile({
    buffer,
    declaredMimeType: mimeType,
    originalName
  });

  const resolvedKind = getKindFromMimeType(validatedMimeType, kind);
  const maxBytes = getMaxBytesForKind(resolvedKind);

  if (size > maxBytes) {
    throw new Error(
      `File vượt quá giới hạn ${Math.round(maxBytes / 1024 / 1024)}MB.`
    );
  }

  const supabase = getSupabaseClient();
  const safeSenderId = sanitizeSenderId(senderId);
  const displayFileName = sanitizeFileName(originalName);
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const storedFileName = `${randomUUID()}.${extensionFromMimeType(validatedMimeType)}`;
  const fileKey = `chats/${safeSenderId}/${year}/${month}/${storedFileName}`;

  const { error } = await supabase.storage
    .from(config.supabaseStorageBucket)
    .upload(fileKey, buffer, {
      contentType: validatedMimeType,
      upsert: false
    });

  if (error) {
    throw new Error(error.message || "Không thể upload file lên Supabase Storage.");
  }

  const fileUrl = await resolveFileUrl(fileKey);
  const result = {
    kind: resolvedKind,
    fileUrl,
    fileKey,
    fileName: displayFileName,
    mimeType: validatedMimeType,
    size
  };

  if (!config.supabaseStoragePublic) {
    result.expiresAt = new Date(
      Date.now() + config.signedUrlTtlSeconds * 1000
    ).toISOString();
  }

  return result;
}

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

async function uploadAvatar({ buffer, mimeType, size, userId }) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Ảnh đại diện không hợp lệ.");
  }

  if (!size || size <= 0 || size > config.maxAvatarBytes) {
    throw new Error("Kích thước ảnh đại diện không hợp lệ.");
  }

  if (!IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error("Chỉ hỗ trợ ảnh JPEG, PNG, WebP hoặc GIF.");
  }

  const validatedMimeType = await validateUploadedFile({
    buffer,
    declaredMimeType: mimeType,
    originalName: `avatar.${extensionFromMimeType(mimeType)}`
  });

  const supabase = getSupabaseClient();
  const safeUserId = sanitizeSenderId(userId);
  const storedFileName = `${randomUUID()}.${extensionFromMimeType(validatedMimeType)}`;
  const fileKey = `avatars/${safeUserId}/${storedFileName}`;

  const { error } = await supabase.storage
    .from(config.supabaseStorageBucket)
    .upload(fileKey, buffer, {
      contentType: validatedMimeType,
      upsert: true
    });

  if (error) {
    throw new Error(error.message || "Không thể upload ảnh đại diện.");
  }

  const avatarUrl = await resolveFileUrl(fileKey);

  return {
    avatarUrl,
    fileKey,
    mimeType: validatedMimeType,
    size
  };
}

module.exports = {
  uploadChatFile,
  uploadAvatar,
  resolveFileUrl
};