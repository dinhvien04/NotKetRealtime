const path = require("path");
const { randomUUID } = require("crypto");
const {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const config = require("../config/env");
const { getS3Client } = require("./s3.service");
const {
  getKindFromMimeType,
  getMaxBytesForKind,
  isAllowedMimeType,
  isVoiceMimeType
} = require("../utils/mime");
const {
  validateUploadedFile,
  extensionFromMimeType,
  hasBlockedExtension
} = require("../utils/file-magic");
const { sanitizeFileName, sanitizeSenderId } = require("../utils/filename");
const logger = require("../utils/logger");

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

function redactPresignedUrl(url) {
  if (typeof url !== "string" || !url) {
    return url;
  }

  return url
    .replace(/(X-Amz-Signature=)[^&\s"']+/gi, "$1[REDACTED]")
    .replace(/(X-Amz-Credential=)[^&\s"']+/gi, "$1[REDACTED]")
    .replace(/(X-Amz-Security-Token=)[^&\s"']+/gi, "$1[REDACTED]");
}

function validateExtensionForMime(fileName, mimeType) {
  const extension = path.extname(String(fileName || "")).toLowerCase().slice(1);
  if (!extension) {
    return;
  }

  const expected = extensionFromMimeType(mimeType);
  if (extension === expected) {
    return;
  }

  if (mimeType === "image/jpeg" && (extension === "jpg" || extension === "jpeg")) {
    return;
  }

  throw new Error("Phần mở rộng file không khớp với MIME type.");
}

function validateUploadMetadata({
  originalName,
  mimeType,
  size,
  senderId,
  kind = null,
  durationMs = null
}) {
  if (!originalName || typeof originalName !== "string") {
    throw new Error("Tên file không hợp lệ.");
  }

  if (!mimeType || !isAllowedMimeType(mimeType)) {
    throw new Error("Loại file không được hỗ trợ.");
  }

  if (hasBlockedExtension(originalName)) {
    throw new Error("Phần mở rộng file không được phép.");
  }

  validateExtensionForMime(originalName, mimeType);

  if (!Number.isFinite(size) || size <= 0) {
    throw new Error("Kích thước file không hợp lệ.");
  }

  const resolvedKind = getKindFromMimeType(mimeType, kind);
  const maxBytes = getMaxBytesForKind(resolvedKind);

  if (size > maxBytes) {
    throw new Error(
      `File vượt quá giới hạn ${Math.round(maxBytes / 1024 / 1024)}MB.`
    );
  }

  if (resolvedKind === "voice") {
    if (!isVoiceMimeType(mimeType)) {
      throw new Error("MIME type không hợp lệ cho voice message.");
    }
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      throw new Error("Voice message cần durationMs hợp lệ.");
    }
    const maxDurationMs = config.maxVoiceSeconds * 1000;
    if (durationMs > maxDurationMs) {
      throw new Error(`Voice message vượt quá ${config.maxVoiceSeconds} giây.`);
    }
  }

  if (!senderId) {
    throw new Error("Thiếu senderId.");
  }

  return {
    resolvedKind,
    displayFileName: sanitizeFileName(originalName),
    safeSenderId: sanitizeSenderId(senderId),
    mimeType
  };
}

async function createPresignedUpload({
  originalName,
  mimeType,
  size,
  senderId,
  kind = null,
  durationMs = null
}) {
  const {
    resolvedKind,
    displayFileName,
    safeSenderId,
    mimeType: validatedMimeType
  } = validateUploadMetadata({
    originalName,
    mimeType,
    size,
    senderId,
    kind,
    durationMs
  });

  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const storedFileName = `${randomUUID()}.${extensionFromMimeType(validatedMimeType)}`;
  const fileKey = `chats/${safeSenderId}/${year}/${month}/${storedFileName}`;

  const s3Client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: fileKey,
    ContentType: validatedMimeType,
    Metadata: {
      originalname: displayFileName.slice(0, 120),
      userid: safeSenderId,
      kind: resolvedKind
    }
  });

  const expiresIn = config.s3PresignedUploadTtlSeconds;
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

  logger.debug("Presigned upload URL created", {
    fileKey,
    kind: resolvedKind,
    uploadUrl: redactPresignedUrl(uploadUrl)
  });

  return {
    uploadUrl,
    method: "PUT",
    headers: {
      "Content-Type": validatedMimeType
    },
    fileKey,
    fileName: displayFileName,
    mimeType: validatedMimeType,
    size,
    kind: resolvedKind,
    durationMs: resolvedKind === "voice" ? durationMs : null,
    expiresIn
  };
}

async function resolveFileUrl(fileKey) {
  if (!fileKey) {
    return null;
  }

  if (config.s3PublicBaseUrl) {
    const base = config.s3PublicBaseUrl.replace(/\/$/, "");
    return `${base}/${fileKey}`;
  }

  const s3Client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: config.s3Bucket,
    Key: fileKey
  });

  const signedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: config.s3SignedUrlTtlSeconds
  });

  logger.debug("Signed GET URL created", {
    fileKey,
    signedUrl: redactPresignedUrl(signedUrl)
  });

  return signedUrl;
}

async function verifyUploadedObject({ fileKey, expectedSize, expectedMimeType }) {
  if (!fileKey) {
    throw new Error("Thiếu fileKey.");
  }

  const s3Client = getS3Client();

  let head;
  try {
    head = await s3Client.send(
      new HeadObjectCommand({
        Bucket: config.s3Bucket,
        Key: fileKey
      })
    );
  } catch (error) {
    if (error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) {
      throw new Error("Object chưa tồn tại trên storage.");
    }
    throw new Error(error?.message || "Không thể xác minh object trên storage.");
  }

  if (!head) {
    throw new Error("Object chưa tồn tại trên storage.");
  }

  if (
    Number.isFinite(expectedSize) &&
    expectedSize > 0 &&
    Number(head.ContentLength) !== Number(expectedSize)
  ) {
    throw new Error("Kích thước object không khớp metadata.");
  }

  if (expectedMimeType && head.ContentType && head.ContentType !== expectedMimeType) {
    throw new Error("Content-Type object không khớp metadata.");
  }

  return true;
}

async function verifyUploadedObjectContent({ fileKey, expectedMimeType, originalName }) {
  if (!fileKey) {
    throw new Error("Thiếu fileKey.");
  }

  const s3Client = getS3Client();

  // Get first bytes (sufficient for magic detection) or full for small files
  const MAX_CONTENT_BYTES = 2 * 1024 * 1024; // 2MB cap to avoid excessive memory
  const getCommand = new GetObjectCommand({
    Bucket: config.s3Bucket,
    Key: fileKey,
    Range: `bytes=0-${MAX_CONTENT_BYTES - 1}`
  });

  let buffer;
  try {
    const response = await s3Client.send(getCommand);
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    buffer = Buffer.concat(chunks);
  } catch (error) {
    if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) {
      throw new Error("Object chưa tồn tại trên storage.");
    }
    throw new Error(error?.message || "Không thể đọc nội dung file từ storage để xác thực.");
  }

  if (!buffer || buffer.length === 0) {
    throw new Error("File rỗng trên storage.");
  }

  // Reuse content validation (magic bytes, office, text, audio etc.)
  await validateUploadedFile({
    buffer,
    declaredMimeType: expectedMimeType,
    originalName
  });

  return true;
}

async function deleteObject(fileKey) {
  if (!fileKey) {
    return false;
  }

  const s3Client = getS3Client();
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: config.s3Bucket,
      Key: fileKey
    })
  );
  return true;
}

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

  const safeUserId = sanitizeSenderId(userId);
  const storedFileName = `${randomUUID()}.${extensionFromMimeType(validatedMimeType)}`;
  const fileKey = `avatars/${safeUserId}/${storedFileName}`;

  const s3Client = getS3Client();
  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: fileKey,
      Body: buffer,
      ContentType: validatedMimeType
    })
  );

  const avatarUrl = await resolveFileUrl(fileKey);

  return {
    avatarUrl,
    fileKey,
    mimeType: validatedMimeType,
    size
  };
}

module.exports = {
  redactPresignedUrl,
  validateUploadMetadata,
  createPresignedUpload,
  resolveFileUrl,
  verifyUploadedObject,
  verifyUploadedObjectContent,
  deleteObject,
  uploadAvatar
};