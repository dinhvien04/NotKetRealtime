const assert = require("assert");

process.env.STORAGE_LIMIT_BYTES = "1000";

const messages = { used: 400 };
const pending = { bytes: 500 };

const documentUploadRepo = {
  async expireOldUploads() {
    return 0;
  },
  async getPendingUploadBytes() {
    return pending.bytes;
  },
  async createPendingUpload() {
    return {};
  },
  async listExpiredPendingUploads() {
    return [];
  },
  async markExpired() {
    return null;
  }
};

const documentMessageRepoWithKey = {
  async getStorageUsage() {
    return messages.used;
  },
  async hasAnyMessageWithFileKey() {
    return false;
  }
};

const storageService = {
  async createPresignedUpload(payload) {
    return {
      uploadUrl: "https://example/upload",
      method: "PUT",
      headers: { "Content-Type": payload.mimeType },
      fileKey: `documents/2026/07/x-${Date.now()}.txt`,
      fileName: payload.originalName,
      mimeType: payload.mimeType,
      size: payload.size,
      kind: payload.kind || "file",
      expiresIn: 300
    };
  }
};

require.cache[require.resolve("../src/repositories/document-message.repository.js")] = {
  id: require.resolve("../src/repositories/document-message.repository.js"),
  filename: require.resolve("../src/repositories/document-message.repository.js"),
  loaded: true,
  exports: documentMessageRepoWithKey
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
  // 400 used + 500 pending + 50 = 950 <= 1000 OK
  await uploadService.assertWithinStorageQuota(50);

  // 400 + 500 + 200 = 1100 > 1000 reject
  await assert.rejects(
    () => uploadService.assertWithinStorageQuota(200),
    /vượt giới hạn|pending/i
  );

  console.log("upload-quota.test.js OK");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
