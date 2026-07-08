const { S3Client } = require("@aws-sdk/client-s3");
const config = require("../config/env");

let client = null;
let testClientOverride = null;

function getStorageConfigError() {
  if (config.storageProvider !== "s3") {
    return "STORAGE_PROVIDER phải là s3.";
  }
  if (!config.s3Bucket) {
    return "Thiếu S3_BUCKET.";
  }
  if (!config.s3AccessKeyId) {
    return "Thiếu S3_ACCESS_KEY_ID.";
  }
  if (!config.s3SecretAccessKey) {
    return "Thiếu S3_SECRET_ACCESS_KEY.";
  }
  return null;
}

function buildS3ClientConfig() {
  const clientConfig = {
    region: config.s3Region,
    credentials: {
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey
    }
  };

  if (config.s3Endpoint) {
    clientConfig.endpoint = config.s3Endpoint;
    clientConfig.forcePathStyle = config.s3ForcePathStyle;
  }

  return clientConfig;
}

function getS3Client() {
  const configError = getStorageConfigError();
  if (configError) {
    throw new Error(configError);
  }

  if (testClientOverride) {
    return testClientOverride;
  }

  if (!client) {
    client = new S3Client(buildS3ClientConfig());
  }

  return client;
}

function setS3ClientForTests(mockClient) {
  testClientOverride = mockClient;
}

function resetS3ClientForTests() {
  testClientOverride = null;
  client = null;
}

module.exports = {
  getS3Client,
  getStorageConfigError,
  setS3ClientForTests,
  resetS3ClientForTests
};