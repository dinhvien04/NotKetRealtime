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
  verifyUploadedObjectContent,
  redactPresignedUrl
} = require("../src/services/storage.service");
const {
  setS3ClientForTests,
  resetS3ClientForTests
} = require("../src/services/s3.service");
const fileMessageService = require("../src/services/file-message.service");

function createMockS3Client(headResponse, headError = null, getBody = null) {
  return {
    send: async (command) => {
      const name = command.constructor.name;
      if (name === "HeadObjectCommand") {
        if (headError) {
          throw headError;
        }
        // ensure ContentLength is present for size checks in content validate
        if (headResponse && !headResponse.ContentLength && headResponse.ContentLength !== 0) {
          headResponse = { ...headResponse, ContentLength: 123 };
        }
        return headResponse || { ContentLength: 123, ContentType: "application/octet-stream" };
      }
      if (name === "PutObjectCommand") {
        return {};
      }
      if (name === "GetObjectCommand") {
        if (getBody) {
          const { Readable } = require("stream");
          const stream = Readable.from([getBody]);
          return { Body: stream };
        }
        return { Body: { [Symbol.asyncIterator]: async function* () {} } };
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

  // content validation: fake bytes with png meta must reject (magic mismatch)
  const badPngBytes = Buffer.from("fake not png data here"); // wrong magic
  setS3ClientForTests(
    createMockS3Client({ ContentLength: 123, ContentType: "image/png" }, null, badPngBytes)
  );
  await assert.rejects(
    () =>
      verifyUploadedObjectContent({
        fileKey: "chats/user-1/2026/07/bad.png",
        expectedMimeType: "image/png",
        originalName: "bad.png"
      }),
    /Không thể xác định loại file từ nội dung/
  );

  // text/plain with null byte (even after "2MB" position) must reject when full read
  const textWithLateNull = Buffer.alloc(3000, "A".charCodeAt(0));
  textWithLateNull[2500] = 0; // null byte
  setS3ClientForTests(
    createMockS3Client({ ContentLength: 3000, ContentType: "text/plain" }, null, textWithLateNull)
  );
  await assert.rejects(
    () =>
      verifyUploadedObjectContent({
        fileKey: "chats/u/long.txt",
        expectedMimeType: "text/plain",
        originalName: "long.txt"
      }),
    /Nội dung file text không hợp lệ/
  );

  // generic zip declared as docx must reject (bad office structure)
  const genericZipBytes = Buffer.from("PK\x03\x04 fake zip content without office xmls");
  setS3ClientForTests(
    createMockS3Client({ ContentLength: 500, ContentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }, null, genericZipBytes)
  );
  await assert.rejects(
    () =>
      verifyUploadedObjectContent({
        fileKey: "chats/u/fake.docx",
        expectedMimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        originalName: "fake.docx"
      }),
    /không hợp lệ|không thể xác định|zip|office/i
  );

  // fake PNG metadata but text bytes (as before) reject
  const textAsPngBytes = Buffer.from("this is plain text pretending to be png");
  setS3ClientForTests(
    createMockS3Client({ ContentLength: 100, ContentType: "image/png" }, null, textAsPngBytes)
  );
  await assert.rejects(
    () =>
      verifyUploadedObjectContent({
        fileKey: "chats/u/text.png",
        expectedMimeType: "image/png",
        originalName: "text.png"
      }),
    /Không thể xác định loại file từ nội dung|không khớp|nội dung file/
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