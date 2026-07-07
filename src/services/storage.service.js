const { randomUUID } = require("crypto");
const config = require("../config/env");
const { getSupabaseClient } = require("./supabase.service");
const { getKindFromMimeType } = require("../utils/mime");
const {
  validateUploadedFile,
  extensionFromMimeType
} = require("../utils/file-magic");
const { sanitizeFileName, sanitizeSenderId } = require("../utils/filename");

async function uploadChatFile({ buffer, originalName, mimeType, size, senderId }) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("File không hợp lệ.");
  }

  if (!size || size <= 0) {
    throw new Error("Kích thước file không hợp lệ.");
  }

  if (size > config.maxUploadBytes) {
    throw new Error(
      `File vượt quá giới hạn ${Math.round(config.maxUploadBytes / 1024 / 1024)}MB.`
    );
  }

  const validatedMimeType = await validateUploadedFile({
    buffer,
    declaredMimeType: mimeType,
    originalName
  });

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

  const { data: publicData } = supabase.storage
    .from(config.supabaseStorageBucket)
    .getPublicUrl(fileKey);

  return {
    kind: getKindFromMimeType(validatedMimeType),
    fileUrl: publicData.publicUrl,
    fileKey,
    fileName: displayFileName,
    mimeType: validatedMimeType,
    size
  };
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

  const { data: publicData } = supabase.storage
    .from(config.supabaseStorageBucket)
    .getPublicUrl(fileKey);

  return {
    avatarUrl: publicData.publicUrl,
    fileKey,
    mimeType: validatedMimeType,
    size
  };
}

module.exports = {
  uploadChatFile,
  uploadAvatar
};