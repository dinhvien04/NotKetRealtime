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
    console.log("Bỏ qua auth API test vì thiếu DATABASE_URL.");
    return;
  }

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const username = `api_user_${Date.now()}`;
  const email = `${username}@test.local`;
  const password = "secret12345";

  try {
    const csrf = await fetchCsrf(baseUrl);

    const duplicate = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: csrfHeaders(csrf.token, csrf.cookie),
      body: JSON.stringify({
        username,
        email,
        password,
        confirmPassword: password
      })
    });
    const duplicateData = await duplicate.json();
    assert.equal(duplicateData.ok, true);

    const duplicateAgain = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: csrfHeaders(csrf.token, csrf.cookie),
      body: JSON.stringify({
        username,
        email,
        password,
        confirmPassword: password
      })
    });
    const duplicateAgainData = await duplicateAgain.json();
    assert.equal(duplicateAgainData.ok, false);

    const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: csrfHeaders(csrf.token, csrf.cookie),
      body: JSON.stringify({
        usernameOrEmail: username,
        password: "wrong-password"
      })
    });
    const badLoginData = await badLogin.json();
    assert.equal(badLoginData.ok, false);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: csrfHeaders(csrf.token, csrf.cookie),
      body: JSON.stringify({
        usernameOrEmail: username,
        password
      })
    });
    const loginData = await login.json();
    const authCookie = extractCookie(login);
    const cookie = mergeCookies(csrf.cookie, authCookie);
    assert.equal(loginData.ok, true);
    assert.ok(cookie);

    const me = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookie }
    });
    const meData = await me.json();
    assert.equal(meData.ok, true);
    assert.equal(meData.user.username, username);

    const unauthorized = await fetch(`${baseUrl}/api/uploads`, { method: "POST" });
    const unauthorizedData = await unauthorized.json();
    assert.equal(unauthorizedData.ok, false);
    assert.equal(unauthorized.status, 401);

    console.log("Đã kiểm tra register/login/me và reject upload chưa login.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await closePool();
  }
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });