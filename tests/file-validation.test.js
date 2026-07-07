const assert = require("assert");
const {
  validateUploadedFile,
  hasBlockedExtension,
  isSafePlainText
} = require("../src/utils/file-magic");

const JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08,
  0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08,
  0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13, 0x0f,
  0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e,
  0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30,
  0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e,
  0x33, 0x34, 0x32, 0xff, 0xd9
]);

async function run() {
  assert.equal(hasBlockedExtension("script.js"), true);
  assert.equal(hasBlockedExtension("photo.png"), false);
  assert.equal(isSafePlainText(Buffer.from("hello world", "utf8")), true);
  assert.equal(isSafePlainText(Buffer.from([0x00, 0x01])), false);

  await validateUploadedFile({
    buffer: JPEG_BUFFER,
    declaredMimeType: "image/jpeg",
    originalName: "demo.jpg"
  });

  try {
    await validateUploadedFile({
      buffer: JPEG_BUFFER,
      declaredMimeType: "image/png",
      originalName: "fake.png"
    });
    assert.fail("Fake MIME phải bị reject");
  } catch (error) {
    assert.match(error.message, /khớp/);
  }

  try {
    await validateUploadedFile({
      buffer: JPEG_BUFFER,
      declaredMimeType: "image/jpeg",
      originalName: "evil.html"
    });
    assert.fail("Blocked extension phải bị reject");
  } catch (error) {
    assert.match(error.message, /không được hỗ trợ/);
  }

  await validateUploadedFile({
    buffer: Buffer.from("plain text ok", "utf8"),
    declaredMimeType: "text/plain",
    originalName: "notes.txt"
  });

  const emptyZip = Buffer.from([
    0x50, 0x4b, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00
  ]);

  try {
    await validateUploadedFile({
      buffer: emptyZip,
      declaredMimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      originalName: "fake.docx"
    });
    assert.fail("Generic ZIP declared docx phải bị reject");
  } catch (error) {
    assert.match(error.message, /Office|khớp|hỗ trợ/);
  }

  assert.equal(hasBlockedExtension("icon.svg"), true);
  assert.equal(hasBlockedExtension("shell.php"), true);
  assert.equal(hasBlockedExtension("photo.jpg.php"), true);

  console.log("Đã kiểm tra magic-byte validation và blocked extensions.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});