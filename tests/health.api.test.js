process.env.APP_OPEN_MODE = "true";
process.env.DATABASE_URL = process.env.DATABASE_URL || "";

const assert = require("assert");
const http = require("http");
const app = require("../src/app");

async function request(server, path) {
  const address = server.address();
  const res = await fetch(`http://127.0.0.1:${address.port}${path}`);
  const data = await res.json();
  return {
    status: res.status,
    data,
    cacheControl: res.headers.get("cache-control")
  };
}

async function run() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const live = await request(server, "/health/live");
    assert.equal(live.status, 200);
    assert.equal(live.data.ok, true);
    assert.ok(
      /no-store/i.test(live.cacheControl || ""),
      `health should be Cache-Control: no-store, got ${live.cacheControl}`
    );

    const config = await request(server, "/api/app/config");
    assert.equal(config.status, 200);
    assert.equal(config.data.ok, true);
    assert.equal(typeof config.data.openMode, "boolean");
    assert.ok(Array.isArray(config.data.allowedMimeTypes));
    assert.ok(
      /no-store/i.test(config.cacheControl || ""),
      `API should be Cache-Control: no-store, got ${config.cacheControl}`
    );

    // HTML pages also no-store
    const address = server.address();
    const htmlRes = await fetch(`http://127.0.0.1:${address.port}/`);
    assert.equal(htmlRes.status, 200);
    assert.ok(
      /no-store/i.test(htmlRes.headers.get("cache-control") || ""),
      "HTML home should be Cache-Control: no-store"
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log("health.api.test.js OK");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
