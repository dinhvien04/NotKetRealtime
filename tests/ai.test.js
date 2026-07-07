process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-secret-key-32chars-minimum!";

const assert = require("assert");
const http = require("http");
const app = require("../src/app");
const { getDatabaseError, closePool } = require("../src/db");
const { extractCookie } = require("./helpers/http");
const { fetchCsrf, csrfHeaders, mergeCookies } = require("./helpers/csrf");

async function registerAndLogin(baseUrl) {
  const username = `ai_user_${Date.now()}`;
  const password = "secret12345";
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
  return extractCookie(login, "notket_token");
}

async function fetchAuthedCsrf(baseUrl, tokenCookie) {
  const response = await fetch(`${baseUrl}/api/csrf-token`, {
    headers: { Cookie: tokenCookie }
  });
  const data = await response.json();
  const csrfCookie = extractCookie(response, "notket_csrf");
  return {
    token: data.csrfToken,
    cookie: mergeCookies(tokenCookie, csrfCookie)
  };
}

async function run() {
  if (getDatabaseError()) {
    console.log("Bỏ qua AI test vì thiếu DATABASE_URL.");
    return;
  }

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const tokenCookie = await registerAndLogin(baseUrl);
    const csrf = await fetchAuthedCsrf(baseUrl, tokenCookie);

    const noCsrf = await fetch(`${baseUrl}/api/ai/sessions`, {
      method: "POST",
      headers: { Cookie: tokenCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test AI" })
    });
    assert.equal(noCsrf.status, 403);

    const create = await fetch(`${baseUrl}/api/ai/sessions`, {
      method: "POST",
      headers: {
        ...csrfHeaders(csrf.token, csrf.cookie),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ title: "Test AI" })
    });
    const createData = await create.json();
    assert.equal(createData.ok, true);
    assert.ok(createData.session?.id);

    const send = await fetch(
      `${baseUrl}/api/ai/sessions/${createData.session.id}/messages`,
      {
        method: "POST",
        headers: {
          ...csrfHeaders(csrf.token, csrf.cookie),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ content: "Xin chào AI" })
      }
    );
    const sendData = await send.json();
    assert.equal(sendData.ok, true);
    assert.ok(sendData.assistantMessage?.content);

    const tooLong = "a".repeat(5000);
    const longRes = await fetch(
      `${baseUrl}/api/ai/sessions/${createData.session.id}/messages`,
      {
        method: "POST",
        headers: {
          ...csrfHeaders(csrf.token, csrf.cookie),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ content: tooLong })
      }
    );
    const longData = await longRes.json();
    assert.equal(longData.ok, false);

    console.log("Đã kiểm tra: AI auth, CSRF, session create, mock reply, input length.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await closePool();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});