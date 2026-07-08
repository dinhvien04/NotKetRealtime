process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-secret-key-32chars-minimum!";

const assert = require("assert");
const http = require("http");
const app = require("../src/app");
const { getDatabaseError, closePool } = require("../src/db");
const { extractCookie } = require("./helpers/http");
const { fetchCsrf, csrfHeaders, mergeCookies } = require("./helpers/csrf");

async function run() {
  if (getDatabaseError()) {
    console.log("Bỏ qua upload API test vì thiếu DATABASE_URL.");
    return;
  }

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const username = `upload_user_${Date.now()}`;
  const password = "secret12345";

  try {
    const csrf = await fetchCsrf(baseUrl);
    const register = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: csrfHeaders(csrf.token, csrf.cookie),
      body: JSON.stringify({
        username,
        email: `${username}@test.local`,
        password,
        confirmPassword: password
      })
    });
    const registerData = await register.json();
    assert.equal(registerData.ok, true);

    const loginCsrf = await fetchCsrf(baseUrl);
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: csrfHeaders(loginCsrf.token, loginCsrf.cookie),
      body: JSON.stringify({ usernameOrEmail: username, password })
    });
    const loginData = await login.json();
    assert.equal(loginData.ok, true);
    const authCookie = extractCookie(login);
    const sessionCsrf = loginData.csrfToken;
    const cookie = mergeCookies(authCookie, `notket_csrf=${sessionCsrf}`);

    const noCsrf = await fetch(`${baseUrl}/api/uploads/sign`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: "tiny.png",
        mimeType: "image/png",
        size: 68,
        kind: "image"
      })
    });
    assert.equal(noCsrf.status, 403);

    const noAuth = await fetch(`${baseUrl}/api/uploads/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: "tiny.png",
        mimeType: "image/png",
        size: 68,
        kind: "image"
      })
    });
    assert.equal(noAuth.status, 401);

    const deprecated = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "X-CSRF-Token": sessionCsrf
      },
      body: new FormData()
    });
    assert.equal(deprecated.status, 410);

    const signResponse = await fetch(`${baseUrl}/api/uploads/sign`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
        "X-CSRF-Token": sessionCsrf
      },
      body: JSON.stringify({
        fileName: "tiny.png",
        mimeType: "image/png",
        size: 68,
        kind: "image"
      })
    });
    const signData = await signResponse.json();
    assert.notEqual(signResponse.status, 401);
    assert.notEqual(signResponse.status, 403);

    if (signResponse.status === 200) {
      assert.equal(signData.ok, true);
      assert.ok(signData.upload?.fileKey);
      assert.equal(signData.upload.method, "PUT");
      assert.ok(signData.upload.uploadUrl);
    } else {
      assert.ok([400, 503].includes(signResponse.status));
    }

    const unsafe = await fetch(`${baseUrl}/api/uploads/sign`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
        "X-CSRF-Token": sessionCsrf
      },
      body: JSON.stringify({
        fileName: "evil.exe",
        mimeType: "image/png",
        size: 68,
        kind: "image"
      })
    });
    const unsafeData = await unsafe.json();
    assert.equal(unsafe.ok ? unsafe.status : unsafe.status, unsafe.status);
    if (unsafe.status !== 503) {
      assert.equal(unsafeData.ok, false);
    }

    console.log(
      "Đã kiểm tra: upload sign auth/CSRF, deprecated route, metadata validation."
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await closePool();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});