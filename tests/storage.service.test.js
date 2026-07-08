process.env.STORAGE_PROVIDER = "s3";
process.env.S3_BUCKET = "test-bucket";
process.env.S3_ACCESS_KEY_ID = "test-access-key";
process.env.S3_SECRET_ACCESS_KEY = "test-secret-key";
process.env.S3_REGION = "ap-southeast-1";
process.env.S3_PRESIGNED_UPLOAD_TTL_SECONDS = "300";
process.env.S3_SIGNED_URL_TTL_SECONDS = "3600";

const assert = require("assert");
const uploadModel = require("../src/models/upload.model");
const {
  validateUploadMetadata,
  verifyUploadedObject,
  redactPresignedUrl
} = require("../src/services/storage.service");
const {
  setS3ClientForTests,
  resetS3ClientForTests
} = require("../src/services/s3.service");
const fileMessageService = require("../src/services/file-message.service");

function createMockS3Client(headResponse, headError = null) {
  return {
    send: async (command) => {
      const name = command.constructor.name;
      if (name === "HeadObjectCommand") {
        if (headError) {
          throw headError;
        }
        return headResponse;
      }
      if (name === "PutObjectCommand") {
        return {};
      }
      if (name === "GetObjectCommand") {
        return {};
      }
      throw new Error(`Unexpected command: ${name}`);
    }
  };
}

async function run() {
  assert.throws(
    () =>
      validateUploadMetadata({
        originalName: "evil.exe",
        mimeType: "image/png",
        size: 1024,
        senderId: "user-1"
      }),
    /Phần mở rộng file không được phép/
  );

  assert.throws(
    () =>
      validateUploadMetadata({
        originalName: "big.png",
        mimeType: "image/png",
        size: 20 * 1024 * 1024,
        senderId: "user-1"
      }),
    /vượt quá giới hạn/
  );

  assert.throws(
    () =>
      validateUploadMetadata({
        originalName: "voice.webm",
        mimeType: "audio/webm",
        size: 100,
        senderId: "user-1",
        kind: "voice",
        durationMs: null
      }),
    /Voice message cần durationMs/
  );

  const pending = uploadModel.addPendingUpload;
  assert.equal(typeof pending, "function");

  uploadModel.addPendingUpload("user-1", {
    fileKey: "chats/user-1/2026/07/demo.png",
    fileName: "demo.png",
    mimeType: "image/png",
    size: 2048,
    kind: "image",
    status: "signed"
  });
  assert.ok(
    uploadModel.getPendingUpload("user-1", "chats/user-1/2026/07/demo.png")
  );

  setS3ClientForTests(
    createMockS3Client({
      ContentLength: 2048,
      ContentType: "image/png"
    })
  );

  await verifyUploadedObject({
    fileKey: "chats/user-1/2026/07/demo.png",
    expectedSize: 2048,
    expectedMimeType: "image/png"
  });

  setS3ClientForTests(
    createMockS3Client(null, {
      name: "NotFound",
      $metadata: { httpStatusCode: 404 }
    })
  );

  await assert.rejects(
    () =>
      verifyUploadedObject({
        fileKey: "missing.png",
        expectedSize: 100,
        expectedMimeType: "image/png"
      }),
    /chưa tồn tại/
  );

  setS3ClientForTests(
    createMockS3Client({
      ContentLength: 999,
      ContentType: "image/png"
    })
  );

  await assert.rejects(
    () =>
      verifyUploadedObject({
        fileKey: "chats/user-1/2026/07/demo.png",
        expectedSize: 2048,
        expectedMimeType: "image/png"
      }),
    /Kích thước object không khớp/
  );

  uploadModel.addPendingUpload("user-2", {
    fileKey: "chats/user-2/2026/07/voice.webm",
    fileName: "voice.webm",
    mimeType: "audio/webm",
    size: 4096,
    kind: "voice",
    durationMs: 1200,
    status: "signed"
  });

  setS3ClientForTests(
    createMockS3Client(null, {
      name: "NotFound",
      $metadata: { httpStatusCode: 404 }
    })
  );

  await assert.rejects(
    () =>
      fileMessageService.buildVerifiedFileMessagePayload(
        { id: "user-2" },
        {
          type: "voice",
          fileKey: "chats/user-2/2026/07/voice.webm",
          fileName: "voice.webm",
          mimeType: "audio/webm",
          size: 4096,
          durationMs: 1200
        }
      ),
    /chưa upload xong/
  );

  const redacted = redactPresignedUrl(
    "https://bucket.s3.amazonaws.com/key?X-Amz-Signature=abc123&X-Amz-Credential=foo"
  );
  assert.ok(redacted.includes("[REDACTED]"));
  assert.ok(!redacted.includes("abc123"));

  resetS3ClientForTests();
  console.log(
    "Đã kiểm tra validate metadata, verify object HEAD, pending upload và redact URL."
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});