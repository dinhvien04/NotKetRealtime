const assert = require("assert");
const logger = require("../src/utils/logger");

async function run() {
  assert.equal(typeof logger.info, "function");
  assert.equal(typeof logger.error, "function");
  // should not throw
  logger.info("test log", {
    url: "https://x?X-Amz-Signature=secretvalue&token=abc"
  });
  console.log("logger.test.js OK");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
