process.env.APP_OPEN_MODE = "false";
process.env.APP_ACCESS_KEY = "integration-test-access-key-32chars!";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://invalid";

const assert = require("assert");
const http = require("http");

// Ensure fresh config/app with protected mode
delete require.cache[require.resolve("../src/config/env")];
delete require.cache[require.resolve("../src/app")];
const app = require("../src/app");

async function request(server, path, options = {}) {
  const address = server.address();
  const headers = options.headers || {};
  const res = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function run() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const missing = await request(server, "/api/messages");
    assert.equal(missing.status, 401);

    const wrong = await request(server, "/api/messages", {
      headers: { "X-App-Access-Key": "nope" }
    });
    assert.equal(wrong.status, 401);

    // correct key may fail on DB but should not 401
    const okKey = await request(server, "/api/messages", {
      headers: { "X-App-Access-Key": process.env.APP_ACCESS_KEY }
    });
    assert.notEqual(okKey.status, 401);

    const signMissing = await request(server, "/api/uploads/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: "a.png",
        mimeType: "image/png",
        size: 10,
        kind: "image"
      })
    });
    assert.equal(signMissing.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log("app-access.api.test.js OK");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
