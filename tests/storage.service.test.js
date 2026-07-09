process.env.STORAGE_PROVIDER = "s3";
process.env.S3_BUCKET = "test-bucket";
process.env.S3_ACCESS_KEY_ID = "test-access-key";
process.env.S3_SECRET_ACCESS_KEY = "test-secret-key";
process.env.S3_REGION = "ap-southeast-1";
process.env.S3_PRESIGNED_UPLOAD_TTL_SECONDS = "300";
process.env.S3_SIGNED_URL_TTL_SECONDS = "3600";
process.env.MAX_FILE_BYTES = "10485760";
process.env.MAX_IMAGE_BYTES = "6291456";

const assert = require("assert");
const {
  validateUploadMetadata,
  verifyUploadedObject,
  verifyUploadedObjectContent,
  redactPresignedUrl,
  createPresignedUpload
} = require("../src/services/storage.service");
const {
  setS3ClientForTests,
  resetS3ClientForTests
} = require("../src/services/s3.service");

// Minimal valid 1x1 PNG
const MINI_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

// Minimal PDF with magic header
const MINI_PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "utf8");

function createMockS3Client(headResponse, headError = null, getBody = null) {
  return {
    send: async (command) => {
      const name = command.constructor.name;
      if (name === "HeadObjectCommand") {
        if (headError) throw headError;
        return headResponse || { ContentLength: 123, ContentType: "application/octet-stream" };
      }
      if (name === "PutObjectCommand") return {};
      if (name === "GetObjectCommand") {
        // Full-object validation: Range must not be required
        if (getBody) {
          const { Readable } = require("stream");
          return { Body: Readable.from([getBody]) };
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
        size: 1024
      }),
    /Phần mở rộng file không được phép/
  );

  assert.throws(
    () =>
      validateUploadMetadata({
        originalName: "page.html",
        mimeType: "text/plain",
        size: 10
      }),
    /Phần mở rộng/
  );

  assert.throws(
    () =>
      validateUploadMetadata({
        originalName: "big.png",
        mimeType: "image/png",
        size: 20 * 1024 * 1024
      }),
    /vượt quá giới hạn/
  );

  assert.throws(
    () =>
      validateUploadMetadata({
        originalName: "x.svg",
        mimeType: "image/svg+xml",
        size: 100
      }),
    /hỗ trợ|phép/
  );

  const redacted = redactPresignedUrl(
    "https://s3.example/obj?X-Amz-Signature=SECRET&X-Amz-Credential=CREDS&AWSAccessKeyId=KEY&Signature=SIG"
  );
  assert.ok(!redacted.includes("SECRET"));
  assert.ok(redacted.includes("[REDACTED]"));

  resetS3ClientForTests();
  setS3ClientForTests(
    createMockS3Client({ ContentLength: 2048, ContentType: "image/png" })
  );

  await verifyUploadedObject({
    fileKey: "documents/2026/07/demo.png",
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

  // fake PNG content (text bytes, image/png declared) should reject
  setS3ClientForTests(
    createMockS3Client(
      { ContentLength: 12, ContentType: "image/png" },
      null,
      Buffer.from("not-an-image")
    )
  );

  await assert.rejects(
    () =>
      verifyUploadedObjectContent({
        fileKey: "documents/2026/07/fake.png",
        expectedMimeType: "image/png",
        originalName: "fake.png",
        expectedSize: 12
      }),
    /không khớp|nội dung|loại file/i
  );

  // fake PDF: text disguised as application/pdf
  const fakePdf = Buffer.from("this is not a pdf file at all");
  setS3ClientForTests(
    createMockS3Client(
      { ContentLength: fakePdf.length, ContentType: "application/pdf" },
      null,
      fakePdf
    )
  );

  await assert.rejects(
    () =>
      verifyUploadedObjectContent({
        fileKey: "documents/2026/07/fake.pdf",
        expectedMimeType: "application/pdf",
        originalName: "fake.pdf",
        expectedSize: fakePdf.length
      }),
    /không khớp|nội dung|loại file|xác định/i
  );

  // real mini PNG accepts
  setS3ClientForTests(
    createMockS3Client(
      { ContentLength: MINI_PNG.length, ContentType: "image/png" },
      null,
      MINI_PNG
    )
  );
  await verifyUploadedObjectContent({
    fileKey: "documents/2026/07/ok.png",
    expectedMimeType: "image/png",
    originalName: "ok.png",
    expectedSize: MINI_PNG.length
  });

  // real mini PDF accepts
  setS3ClientForTests(
    createMockS3Client(
      { ContentLength: MINI_PDF.length, ContentType: "application/pdf" },
      null,
      MINI_PDF
    )
  );
  await verifyUploadedObjectContent({
    fileKey: "documents/2026/07/ok.pdf",
    expectedMimeType: "application/pdf",
    originalName: "ok.pdf",
    expectedSize: MINI_PDF.length
  });

  // text with null byte rejects
  setS3ClientForTests(
    createMockS3Client(
      { ContentLength: 5, ContentType: "text/plain" },
      null,
      Buffer.from([65, 0, 66, 67, 68])
    )
  );

  await assert.rejects(
    () =>
      verifyUploadedObjectContent({
        fileKey: "documents/2026/07/bad.txt",
        expectedMimeType: "text/plain",
        originalName: "bad.txt",
        expectedSize: 5
      }),
    /text không hợp lệ|nội dung/i
  );

  // generic zip declared as docx rejects
  setS3ClientForTests(
    createMockS3Client(
      {
        ContentLength: 30,
        ContentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      },
      null,
      Buffer.from("PK\u0003\u0004not-a-real-docx-structure!!!!!")
    )
  );

  await assert.rejects(
    () =>
      verifyUploadedObjectContent({
        fileKey: "documents/2026/07/fake.docx",
        expectedMimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        originalName: "fake.docx",
        expectedSize: 30
      }),
    /./
  );

  // image/pdf use prefix Range — truncated fake bytes still reject on magic
  setS3ClientForTests(
    createMockS3Client(
      { ContentLength: 100, ContentType: "image/png" },
      null,
      Buffer.from("short")
    )
  );
  await assert.rejects(
    () =>
      verifyUploadedObjectContent({
        fileKey: "documents/2026/07/trunc.png",
        expectedMimeType: "image/png",
        originalName: "trunc.png",
        expectedSize: 100
      }),
    /không khớp|nội dung|loại file|xác định/i
  );

  // text still requires full body — length mismatch rejects
  setS3ClientForTests(
    createMockS3Client(
      { ContentLength: 20, ContentType: "text/plain" },
      null,
      Buffer.from("short")
    )
  );
  await assert.rejects(
    () =>
      verifyUploadedObjectContent({
        fileKey: "documents/2026/07/trunc.txt",
        expectedMimeType: "text/plain",
        originalName: "trunc.txt",
        expectedSize: 20
      }),
    /không đọc đủ|khớp/i
  );

  // presigned upload path prefix
  resetS3ClientForTests();
  const upload = await createPresignedUpload({
    originalName: "note.txt",
    mimeType: "text/plain",
    size: 12,
    kind: "file"
  });
  assert.ok(upload.fileKey.startsWith("documents/"));
  assert.ok(upload.uploadUrl);
  assert.equal(upload.fileName, "note.txt");
  assert.ok(!String(upload.uploadUrl).includes(process.env.S3_SECRET_ACCESS_KEY));

  resetS3ClientForTests();
  console.log("storage.service.test.js OK");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
