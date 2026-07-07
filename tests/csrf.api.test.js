process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-secret-key-32chars-minimum!";

const assert = require("assert");
const http = require("http");
const app = require("../src/app");
const { getDatabaseError, closePool } = require("../src/db");
const { fetchCsrf, csrfHeaders, mergeCookies } = require("./helpers/csrf");
const { extractCookie } = require("./helpers/http");

async function registerUser(baseUrl, username) {
  const password = "secret12345";
  const csrf = await fetchCsrf(baseUrl);
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: csrfHeaders(csrf.token, csrf.cookie),
    body: JSON.stringify({
      username,
      email: `${username}@test.local`,
      password,
      confirmPassword: password
    })
  });
  const data = await response.json();
  assert.equal(data.ok, true, data.error);
  const authCookie = extractCookie(response);
  const sessionCsrf = data.csrfToken;
  const sessionCsrfCookie = sessionCsrf ? `notket_csrf=${sessionCsrf}` : "";
  return {
    user: data.user,
    preLoginCsrf: csrf.token,
    preLoginCookie: csrf.cookie,
    authCookie,
    sessionCsrf,
    apiCookie: mergeCookies(authCookie, sessionCsrfCookie)
  };
}

async function run() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const blocked = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernameOrEmail: "nobody",
        password: "secret12345"
      })
    });
    const blockedData = await blocked.json();
    assert.equal(blocked.status, 403);
    assert.equal(blockedData.ok, false);

    const csrf = await fetchCsrf(baseUrl);
    const loginAttempt = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: csrfHeaders(csrf.token, csrf.cookie),
      body: JSON.stringify({
        usernameOrEmail: "nobody",
        password: "secret12345"
      })
    });
    const loginData = await loginAttempt.json();
    assert.equal(loginAttempt.status, 401);
    assert.equal(loginData.ok, false);

    if (!getDatabaseError()) {
      const stamp = Date.now();
      const account = await registerUser(baseUrl, `csrf_user_${stamp}`);

      const staleCsrfUpload = await fetch(`${baseUrl}/api/uploads`, {
        method: "POST",
        headers: {
          Cookie: account.apiCookie,
          "X-CSRF-Token": account.preLoginCsrf
        },
        body: new FormData()
      });
      assert.equal(staleCsrfUpload.status, 403);

      const validUpload = await fetch(`${baseUrl}/api/uploads`, {
        method: "POST",
        headers: {
          Cookie: account.apiCookie,
          "X-CSRF-Token": account.sessionCsrf
        },
        body: new FormData()
      });
      assert.notEqual(validUpload.status, 403);

      const logout = await fetch(`${baseUrl}/api/auth/logout`, {
        method: "POST",
        headers: csrfHeaders(account.sessionCsrf, account.apiCookie)
      });
      assert.equal(logout.status, 200);
      const logoutCsrf = logout.headers.get("set-cookie") || "";
      assert.ok(
        logoutCsrf.includes("notket_csrf=;") ||
          logoutCsrf.toLowerCase().includes("max-age=0"),
        "Logout phải clear CSRF cookie"
      );
    }

    console.log("Đã kiểm tra CSRF reject, session binding và logout clear.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (!getDatabaseError()) {
      await closePool();
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});