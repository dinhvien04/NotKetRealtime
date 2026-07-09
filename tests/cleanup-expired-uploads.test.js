const assert = require("assert");

const expiredRows = [
  {
    fileKey: "documents/2026/07/orphan.txt",
    fileName: "orphan.txt",
    mimeType: "text/plain",
    fileSize: 10,
    kind: "file",
    status: "pending",
    expiresAt: new Date(Date.now() - 60_000).toISOString()
  },
  {
    fileKey: "documents/2026/07/linked.txt",
    fileName: "linked.txt",
    mimeType: "text/plain",
    fileSize: 20,
    kind: "file",
    status: "pending",
    expiresAt: new Date(Date.now() - 60_000).toISOString()
  }
];

const deletedKeys = [];
const markedKeys = [];
const linkedKeys = new Set(["documents/2026/07/linked.txt"]);

const documentUploadRepo = {
  async listExpiredPendingUploads(limit) {
    assert.ok(limit <= 20);
    return expiredRows.slice(0, limit);
  },
  async markExpired(fileKey) {
    markedKeys.push(fileKey);
    return { fileKey, status: "expired" };
  },
  async expireOldUploads() {
    return 0;
  },
  async getPendingUploadBytes() {
    return 0;
  },
  async createPendingUpload() {
    return {};
  }
};

const documentMessageRepo = {
  async getStorageUsage() {
    return 0;
  },
  async hasAnyMessageWithFileKey(fileKey) {
    return linkedKeys.has(fileKey);
  }
};

const storageService = {
  async deleteObject(fileKey) {
    deletedKeys.push(fileKey);
    return true;
  },
  async createPresignedUpload() {
    return {
      uploadUrl: "https://example/upload",
      method: "PUT",
      headers: {},
      fileKey: "documents/2026/07/new.txt",
      fileName: "new.txt",
      mimeType: "text/plain",
      size: 1,
      kind: "file",
      expiresIn: 300
    };
  }
};

require.cache[require.resolve("../src/repositories/document-message.repository.js")] = {
  id: require.resolve("../src/repositories/document-message.repository.js"),
  filename: require.resolve("../src/repositories/document-message.repository.js"),
  loaded: true,
  exports: documentMessageRepo
};
require.cache[require.resolve("../src/repositories/document-upload.repository.js")] = {
  id: require.resolve("../src/repositories/document-upload.repository.js"),
  filename: require.resolve("../src/repositories/document-upload.repository.js"),
  loaded: true,
  exports: documentUploadRepo
};
require.cache[require.resolve("../src/services/storage.service.js")] = {
  id: require.resolve("../src/services/storage.service.js"),
  filename: require.resolve("../src/services/storage.service.js"),
  loaded: true,
  exports: storageService
};

delete require.cache[require.resolve("../src/services/upload.service.js")];
const uploadService = require("../src/services/upload.service");

async function run() {
  deletedKeys.length = 0;
  markedKeys.length = 0;

  const result = await uploadService.cleanupExpiredUploads({ limit: 20 });

  assert.equal(result.scanned, 2);
  assert.equal(result.deletedObjects, 1);
  assert.equal(result.markedExpired, 2);
  assert.deepEqual(deletedKeys, ["documents/2026/07/orphan.txt"]);
  assert.ok(markedKeys.includes("documents/2026/07/orphan.txt"));
  assert.ok(markedKeys.includes("documents/2026/07/linked.txt"));
  // Linked file must NOT be deleted from S3
  assert.ok(!deletedKeys.includes("documents/2026/07/linked.txt"));

  // Cap limit at 20 even if caller passes higher
  const high = await uploadService.cleanupExpiredUploads({ limit: 100 });
  assert.equal(high.scanned, 2);

  console.log("cleanup-expired-uploads.test.js OK");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
