process.env.S3_BUCKET = "my-bucket";
process.env.S3_REGION = "ap-southeast-1";
process.env.S3_ENDPOINT = "";
process.env.S3_PUBLIC_BASE_URL = "";
process.env.NODE_ENV = "production";

const assert = require("assert");

// Re-require after env so getters see values
delete require.cache[require.resolve("../src/config/env")];
delete require.cache[require.resolve("../src/app")];
const app = require("../src/app");

async function run() {
  const sources = app.getS3ConnectSrc();
  assert.ok(
    sources.includes("https://my-bucket.s3.ap-southeast-1.amazonaws.com"),
    "bucket virtual-host origin"
  );
  assert.ok(
    sources.includes("https://s3.ap-southeast-1.amazonaws.com"),
    "regional path-style origin"
  );
  assert.ok(
    !sources.some((s) => s.includes("*")),
    "no wildcard amazonaws in production CSP"
  );

  process.env.S3_ENDPOINT = "https://s3.custom.example";
  process.env.S3_BUCKET = "b2";
  delete require.cache[require.resolve("../src/config/env")];
  delete require.cache[require.resolve("../src/app")];
  const app2 = require("../src/app");
  const endpointSources = app2.getS3ConnectSrc();
  assert.ok(endpointSources.includes("https://s3.custom.example"));
  assert.ok(!endpointSources.some((s) => s.includes("*.amazonaws.com")));

  console.log("csp-connect-src.test.js OK");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
