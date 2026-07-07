process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-secret-key-32chars-minimum!";

const assert = require("assert");
const http = require("http");
const app = require("../src/app");
const { fetchCsrf, csrfHeaders } = require("./helpers/csrf");

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

    console.log("Đã kiểm tra CSRF reject và cho phép request có token hợp lệ.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});