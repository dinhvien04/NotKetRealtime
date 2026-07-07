const assert = require("assert");
const { getKindFromMimeType, getMaxBytesForKind } = require("../src/utils/mime");
const { validateVoiceDuration } = require("../src/models/message.model");

async function run() {
  assert.equal(getKindFromMimeType("audio/webm"), "voice");
  assert.equal(getKindFromMimeType("image/png"), "image");
  assert.equal(getMaxBytesForKind("voice") > getMaxBytesForKind("image"), true);
  assert.equal(validateVoiceDuration(1500), 1500);

  try {
    validateVoiceDuration(0);
    assert.fail("Voice duration 0 phải bị reject");
  } catch (error) {
    assert.match(error.message, /thời lượng/i);
  }

  console.log("Đã kiểm tra voice MIME kind và duration validation.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});