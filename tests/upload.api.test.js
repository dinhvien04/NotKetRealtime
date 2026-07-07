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
    const cookie = mergeCookies(loginCsrf.cookie, extractCookie(login));

    const noCsrf = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: { Cookie: cookie },
      body: new FormData()
    });
    assert.equal(noCsrf.status, 403);

    const noAuth = await fetch(`${baseUrl}/api/uploads`, { method: "POST" });
    assert.equal(noAuth.status, 401);

    const uploadCsrf = await fetchCsrf(baseUrl);
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([pngBuffer], { type: "image/png" }),
      "tiny.png"
    );

    const uploadWithoutSocket = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: {
        Cookie: mergeCookies(uploadCsrf.cookie, cookie),
        "X-CSRF-Token": uploadCsrf.token
      },
      body: formData
    });
    const uploadData = await uploadWithoutSocket.json();
    assert.notEqual(uploadWithoutSocket.status, 401);
    assert.notEqual(uploadWithoutSocket.status, 403);
    const errorText = String(uploadData.error || "");
    assert.ok(!/presence|offline|phải online|chưa kết nối/i.test(errorText));

    if (uploadWithoutSocket.status === 200) {
      assert.equal(uploadData.ok, true);
      assert.ok(uploadData.file?.fileKey);
    } else {
      assert.ok([400, 503].includes(uploadWithoutSocket.status));
    }

    console.log(
      "Đã kiểm tra: upload unauthorized + CSRF reject + upload không cần socket."
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