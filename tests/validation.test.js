const assert = require("assert");
const { isValidUuid, assertValidUuid } = require("../src/utils/validation");

function run() {
  const valid = "550e8400-e29b-41d4-a716-446655440000";
  assert.equal(isValidUuid(valid), true);
  assert.equal(isValidUuid("not-a-uuid"), false);
  assert.equal(isValidUuid(""), false);

  assert.doesNotThrow(() => assertValidUuid(valid, "conversationId"));
  assert.throws(() => assertValidUuid("bad-id", "messageId"), /messageId/);

  console.log("Đã kiểm tra UUID validation helper.");
}

run();