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
  isAllowedMimeType
} = require("../utils/mime");
const {
  validateUploadedFile,
  extensionFromMimeType,
  hasBlockedExtension
} = require("../utils/file-magic");
const { sanitizeFileName } = require("../utils/filename");
const logger = require("../utils/logger");

function redactPresignedUrl(url) {
  if (typeof url !== "string" || !url) {
    return url;
  }

  return url
    .replace(/(X-Amz-Signature=)[^&\s"']+/gi, "$1[REDACTED]")
    .replace(/(X-Amz-Credential=)[^&\s"']+/gi, "$1[REDACTED]")
    .replace(/(X-Amz-Security-Token=)[^&\s"']+/gi, "$1[REDACTED]")
    .replace(/(AWSAccessKeyId=)[^&\s"']+/gi, "$1[REDACTED]")
    .replace(/(Signature=)[^&\s"']+/gi, "$1[REDACTED]");
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

function validateUploadMetadata({ originalName, mimeType, size, kind = null }) {
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
  if (resolvedKind !== "image" && resolvedKind !== "file") {
    throw new Error("Loại upload không hợp lệ.");
  }

  if (resolvedKind === "image" && !mimeType.startsWith("image/")) {
    throw new Error("MIME type không hợp lệ cho ảnh.");
  }

  const maxBytes = getMaxBytesForKind(resolvedKind);
  if (size > maxBytes) {
    throw new Error(
      `File vượt quá giới hạn ${Math.round(maxBytes / 1024 / 1024)}MB.`
    );
  }

  return {
    resolvedKind,
    displayFileName: sanitizeFileName(originalName),
    mimeType
  };
}

async function createPresignedUpload({ originalName, mimeType, size, kind = null }) {
  const {
    resolvedKind,
    displayFileName,
    mimeType: validatedMimeType
  } = validateUploadMetadata({
    originalName,
    mimeType,
    size,
    kind
  });

  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const storedFileName = `${randomUUID()}.${extensionFromMimeType(validatedMimeType)}`;
  const fileKey = `documents/${year}/${month}/${storedFileName}`;

  const s3Client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: fileKey,
    ContentType: validatedMimeType,
    Metadata: {
      originalname: displayFileName.slice(0, 120),
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
    // S3 may append charset; compare base type
    const headBase = String(head.ContentType).split(";")[0].trim();
    if (headBase !== expectedMimeType) {
      throw new Error("Content-Type object không khớp metadata.");
    }
  }

  return true;
}

async function verifyUploadedObjectContent({
  fileKey,
  expectedMimeType,
  originalName,
  expectedSize
}) {
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
    if (error?.name === "NoSuchKey" || error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) {
      throw new Error("Object chưa tồn tại trên storage.");
    }
    throw new Error(error?.message || "Không thể xác minh object trên storage.");
  }

  const realSize = Number(head.ContentLength || 0);
  if (realSize <= 0) {
    throw new Error("File rỗng trên storage.");
  }

  if (Number.isFinite(expectedSize) && expectedSize > 0 && realSize !== Number(expectedSize)) {
    throw new Error("Kích thước object không khớp metadata.");
  }

  const kind = getKindFromMimeType(expectedMimeType);
  const maxBytes = getMaxBytesForKind(kind);
  if (realSize > maxBytes) {
    throw new Error(`File vượt quá giới hạn ${Math.round(maxBytes / 1024 / 1024)}MB.`);
  }

  // Content validation strategy (Vercel-friendly):
  // - text/plain + Office OOXML/legacy: full object (null-byte / ZIP structure).
  // - image/* + application/pdf: first 8KB only for magic-byte detection
  //   (avoids downloading 6–10MB into a serverless function on every confirm).
  const isTextPlain = expectedMimeType === "text/plain";
  const isOffice =
    expectedMimeType === "application/msword" ||
    expectedMimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    expectedMimeType === "application/vnd.ms-excel" ||
    expectedMimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    expectedMimeType === "application/vnd.ms-powerpoint" ||
    expectedMimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  const needsFullBody = isTextPlain || isOffice;
  const PREFIX_BYTES = 8192;

  const getParams = {
    Bucket: config.s3Bucket,
    Key: fileKey
  };
  if (!needsFullBody) {
    const prefixBytes = Math.min(PREFIX_BYTES, realSize);
    getParams.Range = `bytes=0-${prefixBytes - 1}`;
  }

  let buffer;
  try {
    const response = await s3Client.send(new GetObjectCommand(getParams));
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

  if (needsFullBody && buffer.length !== realSize) {
    throw new Error("Không đọc đủ nội dung object từ storage.");
  }

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

module.exports = {
  redactPresignedUrl,
  validateUploadMetadata,
  createPresignedUpload,
  resolveFileUrl,
  verifyUploadedObject,
  verifyUploadedObjectContent,
  deleteObject
};
