process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-secret-key-32chars-minimum!";

const assert = require("assert");
const http = require("http");
const app = require("../src/app");
const { getDatabaseError, closePool } = require("../src/db");
const { fetchCsrf, csrfHeaders } = require("./helpers/csrf");
const passwordResetRepository = require("../src/repositories/password-reset.repository");
const { hashOtp } = require("../src/services/password-reset.service");

async function run() {
  if (getDatabaseError()) {
    console.log("Bỏ qua password reset API test vì thiếu DATABASE_URL.");
    return;
  }

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const csrf = await fetchCsrf(baseUrl);
    const stamp = Date.now();
    const email = `reset_${stamp}@test.local`;

    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: csrfHeaders(csrf.token, csrf.cookie),
      body: JSON.stringify({
        username: `reset_user_${stamp}`,
        email,
        password: "secret12345",
        confirmPassword: "secret12345"
      })
    });
    const registerData = await registerResponse.json();
    assert.equal(registerData.ok, true);

    const forgot = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: csrfHeaders(csrf.token, csrf.cookie),
      body: JSON.stringify({ email })
    });
    const forgotData = await forgot.json();
    assert.equal(forgotData.ok, true);
    assert.match(forgotData.message, /email tồn tại/i);

    await passwordResetRepository.invalidateActiveForEmail(email);

    const otp = "424242";
    await passwordResetRepository.createToken({
      userId: registerData.user.id,
      email,
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      requestIp: null
    });

    const verify = await fetch(`${baseUrl}/api/auth/verify-reset-otp`, {
      method: "POST",
      headers: csrfHeaders(csrf.token, csrf.cookie),
      body: JSON.stringify({ email, otp })
    });
    const verifyData = await verify.json();
    assert.equal(verifyData.ok, true, verifyData.error);
    assert.ok(verifyData.resetTokenId);

    const reset = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: csrfHeaders(csrf.token, csrf.cookie),
      body: JSON.stringify({
        resetTokenId: verifyData.resetTokenId,
        password: "resetpass123",
        confirmPassword: "resetpass123"
      })
    });
    const resetData = await reset.json();
    assert.equal(resetData.ok, true, resetData.error);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: csrfHeaders(csrf.token, csrf.cookie),
      body: JSON.stringify({
        usernameOrEmail: email,
        password: "resetpass123"
      })
    });
    const loginData = await login.json();
    assert.equal(loginData.ok, true);

    console.log("Đã kiểm tra forgot/verify/reset password flow.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await closePool();
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });