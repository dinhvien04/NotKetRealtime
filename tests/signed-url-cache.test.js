/**
 * Signed GET URL in-memory cache: reuse within TTL; do not cache PUT URLs.
 */
process.env.STORAGE_PROVIDER = "s3";
process.env.S3_BUCKET = "test-bucket";
process.env.S3_ACCESS_KEY_ID = "test-access-key";
process.env.S3_SECRET_ACCESS_KEY = "test-secret-key";
process.env.S3_REGION = "ap-southeast-1";
process.env.S3_SIGNED_URL_TTL_SECONDS = "3600";
process.env.S3_PRESIGNED_UPLOAD_TTL_SECONDS = "300";
delete process.env.S3_PUBLIC_BASE_URL;

const assert = require("assert");

let signCount = 0;
const presignerPath = require.resolve("@aws-sdk/s3-request-presigner");
const realPresigner = require(presignerPath);

require.cache[presignerPath] = {
  id: presignerPath,
  filename: presignerPath,
  loaded: true,
  exports: {
    ...realPresigner,
    getSignedUrl: async (_client, command) => {
      signCount += 1;
      const name = command?.constructor?.name || "Unknown";
      return `https://signed.example/${name}?n=${signCount}&X-Amz-Signature=fake`;
    }
  }
};

// Reload storage.service so it picks up the mocked presigner
const storagePath = require.resolve("../src/services/storage.service");
delete require.cache[storagePath];

const {
  resolveFileUrl,
  createPresignedUpload,
  clearSignedUrlCache,
  getSignedUrlCacheSize,
  getSignedUrlCacheTtlMs
} = require("../src/services/storage.service");
const {
  setS3ClientForTests,
  resetS3ClientForTests
} = require("../src/services/s3.service");

async function run() {
  resetS3ClientForTests();
  setS3ClientForTests({
    send: async () => ({}),
    config: {
      credentials: async () => ({ accessKeyId: "a", secretAccessKey: "b" })
    },
    middlewareStack: { add: () => {}, clone: () => ({ add: () => {} }) }
  });

  clearSignedUrlCache();
  signCount = 0;

  assert.ok(getSignedUrlCacheTtlMs() > 0, "cache TTL should be signed TTL - 60s");

  const key = "documents/2026/07/cache-me.png";
  const url1 = await resolveFileUrl(key);
  const url2 = await resolveFileUrl(key);

  assert.equal(url1, url2, "second resolve should return cached URL");
  assert.equal(signCount, 1, "getSignedUrl should run once for same fileKey");
  assert.equal(getSignedUrlCacheSize(), 1);

  const urlOther = await resolveFileUrl("documents/2026/07/other.png");
  assert.notEqual(urlOther, url1);
  assert.equal(signCount, 2);
  assert.equal(getSignedUrlCacheSize(), 2);

  // Presigned PUT uses getSignedUrl but must not write to signedUrlCache
  const sizeBeforePut = getSignedUrlCacheSize();
  const putSignBefore = signCount;
  await createPresignedUpload({
    originalName: "note.txt",
    mimeType: "text/plain",
    size: 8,
    kind: "file"
  });
  assert.ok(signCount > putSignBefore, "PUT still signs a URL");
  assert.equal(
    getSignedUrlCacheSize(),
    sizeBeforePut,
    "PUT uploadUrl must not be stored in signedUrlCache"
  );

  clearSignedUrlCache();
  assert.equal(getSignedUrlCacheSize(), 0);
  await resolveFileUrl(key);
  assert.equal(signCount, putSignBefore + 1 + 1); // +1 put, +1 after clear

  resetS3ClientForTests();
  clearSignedUrlCache();
  console.log("signed-url-cache.test.js OK");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
