const assert = require("assert");
const {
  validateUploadedFile,
  hasBlockedExtension,
  isSafePlainText
} = require("../src/utils/file-magic");

async function run() {
  assert.equal(hasBlockedExtension("a.exe"), true);
  assert.equal(hasBlockedExtension("a.svg"), true);
  assert.equal(hasBlockedExtension("a.html"), true);
  assert.equal(hasBlockedExtension("a.js"), true);
  assert.equal(hasBlockedExtension("a.zip"), true);
  assert.equal(hasBlockedExtension("a.png"), false);

  assert.equal(isSafePlainText(Buffer.from("hello")), true);
  assert.equal(isSafePlainText(Buffer.from([1, 0, 2])), false);

  await assert.rejects(
    () =>
      validateUploadedFile({
        buffer: Buffer.from("hello"),
        declaredMimeType: "image/png",
        originalName: "x.png"
      }),
    /không khớp|xác định/i
  );

  const textOk = await validateUploadedFile({
    buffer: Buffer.from("hello world"),
    declaredMimeType: "text/plain",
    originalName: "note.txt"
  });
  assert.equal(textOk, "text/plain");

  await assert.rejects(
    () =>
      validateUploadedFile({
        buffer: Buffer.from("x"),
        declaredMimeType: "text/plain",
        originalName: "x.js"
      }),
    /hỗ trợ|phép/
  );

  // minimal PNG header
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde
  ]);
  const pngOk = await validateUploadedFile({
    buffer: png,
    declaredMimeType: "image/png",
    originalName: "1.png"
  });
  assert.equal(pngOk, "image/png");

  console.log("file-validation.test.js OK");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
