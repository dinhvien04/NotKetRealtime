const { randomUUID } = require("crypto");
const config = require("../config/env");
const { getSupabaseClient } = require("./supabase.service");
const { isAllowedMimeType, getKindFromMimeType } = require("../utils/mime");
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

  if (!isAllowedMimeType(mimeType)) {
    throw new Error("Loại file không được hỗ trợ.");
  }

  const supabase = getSupabaseClient();
  const safeSenderId = sanitizeSenderId(senderId);
  const safeFileName = sanitizeFileName(originalName);
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const fileKey = `chats/${safeSenderId}/${year}/${month}/${randomUUID()}-${safeFileName}`;

  const { error } = await supabase.storage
    .from(config.supabaseStorageBucket)
    .upload(fileKey, buffer, {
      contentType: mimeType,
      upsert: false
    });

  if (error) {
    throw new Error(error.message || "Không thể upload file lên Supabase Storage.");
  }

  const { data: publicData } = supabase.storage
    .from(config.supabaseStorageBucket)
    .getPublicUrl(fileKey);

  return {
    kind: getKindFromMimeType(mimeType),
    fileUrl: publicData.publicUrl,
    fileKey,
    fileName: safeFileName,
    mimeType,
    size
  };
}

module.exports = {
  uploadChatFile
};