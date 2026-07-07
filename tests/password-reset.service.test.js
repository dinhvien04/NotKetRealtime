process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-secret-key-32chars-minimum!";

const assert = require("assert");
const {
  hashOtp,
  verifyOtpHash,
  GENERIC_FORGOT_MESSAGE
} = require("../src/services/password-reset.service");

function run() {
  const otp = "123456";
  const hashed = hashOtp(otp);
  assert.equal(verifyOtpHash(otp, hashed), true);
  assert.equal(verifyOtpHash("000000", hashed), false);
  assert.match(GENERIC_FORGOT_MESSAGE, /email tồn tại/i);
  console.log("Đã kiểm tra OTP hash helper và message chung forgot password.");
}

run();