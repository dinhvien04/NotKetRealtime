process.env.STORAGE_PROVIDER = "s3";
process.env.S3_BUCKET = "test-bucket";
process.env.S3_ACCESS_KEY_ID = "test-access";
process.env.S3_SECRET_ACCESS_KEY = "test-secret";
process.env.S3_REGION = "ap-southeast-1";

const assert = require("assert");
const {
  getS3Client,
  setS3ClientForTests,
  resetS3ClientForTests,
  getStorageConfigError
} = require("../src/services/s3.service");

async function run() {
  const savedBucket = process.env.S3_BUCKET;
  process.env.S3_BUCKET = "";
  assert.ok(getStorageConfigError());
  process.env.S3_BUCKET = savedBucket;

  resetS3ClientForTests();
  const client = getS3Client();
  assert.ok(client);

  const calls = [];
  setS3ClientForTests({
    send: async (cmd) => {
      calls.push(cmd.constructor.name);
      return {};
    }
  });
  await getS3Client().send({ constructor: { name: "HeadObjectCommand" }, input: {} });
  assert.ok(calls.length >= 1);

  resetS3ClientForTests();
  console.log("s3.service.test.js OK");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
