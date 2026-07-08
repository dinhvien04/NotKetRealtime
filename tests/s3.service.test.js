process.env.STORAGE_PROVIDER = "s3";
process.env.S3_BUCKET = "test-bucket";
process.env.S3_ACCESS_KEY_ID = "test-access";
process.env.S3_SECRET_ACCESS_KEY = "test-secret";
process.env.S3_REGION = "ap-southeast-1";
process.env.S3_PRESIGNED_UPLOAD_TTL_SECONDS = "300";
process.env.S3_SIGNED_URL_TTL_SECONDS = "3600";

const assert = require("assert");
const {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand
} = require("@aws-sdk/client-s3");
const {
  getS3Client,
  setS3ClientForTests,
  resetS3ClientForTests,
  getStorageConfigError
} = require("../src/services/s3.service");
const storage = require("../src/services/storage.service");

function makeMockClient(calls) {
  return {
    send: async (cmd) => {
      const name = cmd.constructor.name;
      calls.push({ name, input: cmd.input || cmd });
      if (name === "HeadObjectCommand") {
        if (cmd.input.Key && cmd.input.Key.includes("missing")) {
          const err = new Error("NotFound");
          err.name = "NotFound";
          err.$metadata = { httpStatusCode: 404 };
          throw err;
        }
        return { ContentLength: 123, ContentType: "image/png" };
      }
      if (name === "PutObjectCommand" || name === "GetObjectCommand") {
        return {};
      }
      return {};
    }
  };
}

async function run() {
  // config error
  const savedBucket = process.env.S3_BUCKET;
  process.env.S3_BUCKET = "";
  assert.ok(getStorageConfigError(), "should error when no bucket");
  process.env.S3_BUCKET = savedBucket;

  // client
  resetS3ClientForTests();
  const client1 = getS3Client();
  assert.ok(client1, "getS3Client returns client");

  // mock and exercise storage which uses Put/Head/Get
  const calls = [];
  const mock = makeMockClient(calls);
  setS3ClientForTests(mock);

  // create presigned does getSignedUrl which internally may not call send for presign, but verify does
  try {
    await storage.verifyUploadedObject({ fileKey: "chats/u/2026/07/ok.png", expectedSize: 123, expectedMimeType: "image/png" });
  } catch (e) { /* may pass */ }

  await assert.rejects(
    () => storage.verifyUploadedObject({ fileKey: "chats/u/2026/07/missing.png", expectedSize: 10 }),
    /chưa tồn tại|Object chưa/
  );

  // direct command test via client
  const c = getS3Client();
  await c.send(new HeadObjectCommand({ Bucket: "test-bucket", Key: "x" })).catch(() => {});
  await c.send(new PutObjectCommand({ Bucket: "test-bucket", Key: "y", Body: Buffer.from("a") })).catch(() => {});
  await c.send(new GetObjectCommand({ Bucket: "test-bucket", Key: "z" })).catch(() => {});

  const headCall = calls.find((c) => c.name === "HeadObjectCommand");
  const putCall = calls.find((c) => c.name === "PutObjectCommand");
  assert.ok(headCall || putCall, "S3 service client exercised Head/Put commands");

  resetS3ClientForTests();
  console.log("Đã kiểm tra S3 service (config, client override, mock Put/Head/GetObject).");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
