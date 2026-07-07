process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-secret-key-32chars-minimum!";

const assert = require("assert");
const argon2 = require("argon2");
const authService = require("../src/services/auth.service");

async function runValidationTests() {

  try {
    authService.validateUsername("ab");
    assert.fail("Username ngắn phải bị reject");
  } catch (error) {
    assert.match(error.message, /3 đến 40/);
  }

  try {
    authService.validatePassword("123");
    assert.fail("Password ngắn phải bị reject");
  } catch (error) {
    assert.match(error.message, /8 ký tự/);
  }

  try {
    authService.validateEmail("invalid-email");
    assert.fail("Email sai phải bị reject");
  } catch (error) {
    assert.match(error.message, /Email/);
  }

  const token = authService.createToken({
    id: "11111111-1111-1111-1111-111111111111",
    username: "tester",
    displayName: "Tester"
  });
  const payload = authService.verifyToken(token);
  assert.equal(payload.sub, "11111111-1111-1111-1111-111111111111");
  assert.equal(payload.username, "tester");

  const hash = await argon2.hash("secret12345", { type: argon2.argon2id });
  const valid = await argon2.verify(hash, "secret12345");
  assert.equal(valid, true);

  console.log("Đã kiểm tra validation auth và JWT helper.");
}

runValidationTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});