const assert = require("assert");

// Mock repositories and storage before requiring service
const messages = [];
const uploads = new Map();

const documentMessageRepo = {
  async createTextMessage({ body }) {
    const row = {
      id: `id-${messages.length + 1}`,
      type: "text",
      body,
      fileKey: null,
      fileName: null,
      mimeType: null,
      fileSize: null,
      createdAt: new Date().toISOString(),
      deletedAt: null
    };
    messages.push(row);
    return row;
  },
  async createFileMessage(payload) {
    const row = {
      id: `id-${messages.length + 1}`,
      type: payload.type,
      body: payload.body,
      fileKey: payload.fileKey,
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      fileSize: payload.fileSize,
      createdAt: new Date().toISOString(),
      deletedAt: null
    };
    messages.push(row);
    return row;
  },
  async listMessages({ q = "", type = "all" } = {}) {
    let list = messages.filter((m) => !m.deletedAt);
    if (type !== "all") list = list.filter((m) => m.type === type);
    if (q) {
      const needle = q.toLowerCase();
      list = list.filter(
        (m) =>
          (m.body && m.body.toLowerCase().includes(needle)) ||
          (m.fileName && m.fileName.toLowerCase().includes(needle))
      );
    }
    list = list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return { messages: list, nextCursor: null, hasMore: false };
  },
  async findById(id) {
    return messages.find((m) => m.id === id && !m.deletedAt) || null;
  },
  async findByFileKey(fileKey) {
    return messages.find((m) => m.fileKey === fileKey && !m.deletedAt) || null;
  },
  async softDelete(id) {
    const row = messages.find((m) => m.id === id && !m.deletedAt);
    if (!row) return null;
    row.deletedAt = new Date().toISOString();
    return row;
  },
  async getStorageUsage() {
    return messages
      .filter((m) => !m.deletedAt && (m.type === "image" || m.type === "file"))
      .reduce((sum, m) => sum + (m.fileSize || 0), 0);
  },
  async listRecentByType() {
    return [];
  }
};

const documentUploadRepo = {
  async createPendingUpload(row) {
    const entry = { ...row, status: "pending" };
    uploads.set(row.fileKey, entry);
    return entry;
  },
  async findPendingUpload(fileKey) {
    return uploads.get(fileKey) || null;
  },
  async consumePendingUpload(fileKey) {
    const row = uploads.get(fileKey);
    if (!row || row.status !== "pending") return null;
    if (new Date(row.expiresAt).getTime() <= Date.now()) return null;
    row.status = "consumed";
    row.consumedAt = new Date().toISOString();
    return row;
  },
  async expireOldUploads() {
    return 0;
  }
};

const storageService = {
  async resolveFileUrl(fileKey) {
    return `https://signed.example/${fileKey}`;
  },
  async verifyUploadedObject() {
    return true;
  },
  async verifyUploadedObjectContent() {
    return true;
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

process.env.STORAGE_LIMIT_BYTES = "1073741824";

delete require.cache[require.resolve("../src/services/document-message.service.js")];
const service = require("../src/services/document-message.service");

async function run() {
  messages.length = 0;
  uploads.clear();

  const text = await service.createTextMessage("  hello  ");
  assert.equal(text.body, "hello");
  assert.equal(text.type, "text");

  await assert.rejects(() => service.createTextMessage("   "), /trống/);
  await assert.rejects(() => service.createTextMessage("x".repeat(5001)), /tối đa/);

  const listed = await service.listMessages({});
  assert.equal(listed.messages.length, 1);

  await documentMessageRepo.createTextMessage({ body: "searchable note" });
  const searched = await service.listMessages({ q: "searchable" });
  assert.equal(searched.messages.length, 1);

  const expiresAt = new Date(Date.now() + 60000).toISOString();
  await documentUploadRepo.createPendingUpload({
    fileKey: "documents/2026/07/a.png",
    fileName: "a.png",
    mimeType: "image/png",
    fileSize: 123,
    kind: "image",
    expiresAt
  });

  const fileMsg = await service.createFileMessage({
    fileKey: "documents/2026/07/a.png",
    fileName: "a.png",
    mimeType: "image/png",
    size: 123,
    kind: "image",
    caption: "cap"
  });
  assert.equal(fileMsg.type, "image");
  assert.ok(fileMsg.fileUrl);

  // pending consumed
  assert.equal((await documentUploadRepo.findPendingUpload("documents/2026/07/a.png")).status, "consumed");

  // metadata mismatch
  await documentUploadRepo.createPendingUpload({
    fileKey: "documents/2026/07/b.png",
    fileName: "b.png",
    mimeType: "image/png",
    fileSize: 10,
    kind: "image",
    expiresAt
  });
  await assert.rejects(
    () =>
      service.createFileMessage({
        fileKey: "documents/2026/07/b.png",
        fileName: "wrong.png",
        mimeType: "image/png",
        size: 10,
        kind: "image"
      }),
    /Metadata không khớp/
  );

  const byName = await service.listMessages({ q: "a.png" });
  assert.ok(byName.messages.some((m) => m.fileName === "a.png"));

  const images = await service.listMessages({ type: "image" });
  assert.ok(images.messages.every((m) => m.type === "image"));

  const deleted = await service.softDelete(text.id);
  assert.ok(deleted.deletedAt);

  const refreshed = await service.refreshFileUrl("documents/2026/07/a.png");
  assert.ok(refreshed.fileUrl);

  await assert.rejects(() => service.refreshFileUrl("missing"), /Không tìm thấy/);

  const usage = await service.getStorageUsage();
  assert.equal(usage.usedBytes, 123);

  console.log("document-messages.service.test.js OK");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
