process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-secret-key-32chars-minimum!";

const assert = require("assert");

let resolveCalls = 0;
const storageService = require("../src/services/storage.service");
const originalResolve = storageService.resolveFileUrl;

storageService.resolveFileUrl = async (fileKey) => {
  resolveCalls += 1;
  if (fileKey === "broken-key") {
    throw new Error("Signed URL failed");
  }
  return `https://example.com/${fileKey}`;
};

const messageRepository = require("../src/repositories/message.repository");

async function run() {
  resolveCalls = 0;
  const sharedKey = "shared-file-key";
  const messages = [
    { id: "1", isDeleted: false, fileKey: sharedKey },
    { id: "2", isDeleted: false, fileKey: sharedKey },
    { id: "3", isDeleted: true, fileKey: "deleted-key" },
    { id: "4", isDeleted: false, fileKey: "broken-key" }
  ];

  const enriched = await messageRepository.enrichFileUrls(messages);
  assert.equal(resolveCalls, 2, "Phải dedupe fileKey khi resolve");
  assert.equal(enriched[0].fileUrl, `https://example.com/${sharedKey}`);
  assert.equal(enriched[1].fileUrl, `https://example.com/${sharedKey}`);
  assert.equal(enriched[2].fileUrl, undefined);
  assert.equal(enriched[3].fileUnavailable, true);

  storageService.resolveFileUrl = originalResolve;
  console.log("Đã kiểm tra signed URL dedupe và partial failure.");
}

run().catch((error) => {
  storageService.resolveFileUrl = originalResolve;
  console.error(error);
  process.exitCode = 1;
});