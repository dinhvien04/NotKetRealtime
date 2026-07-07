process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-secret-key-32chars-minimum!";

const assert = require("assert");
const http = require("http");
const app = require("../src/app");
const { getDatabaseError, closePool } = require("../src/db");

async function run() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const live = await fetch(`${baseUrl}/health/live`);
    const liveData = await live.json();
    assert.equal(live.status, 200);
    assert.equal(liveData.ok, true);
    assert.ok(liveData.uptimeSeconds >= 0);

    const health = await fetch(`${baseUrl}/health`);
    const healthData = await health.json();
    assert.ok(health.status === 200 || health.status === 503);
    assert.equal(typeof healthData.ok, "boolean");
    assert.ok(healthData.services);
    assert.ok(healthData.services.database);

    if (!getDatabaseError()) {
      assert.equal(healthData.services.database.ok, true);
    }

    const ready = await fetch(`${baseUrl}/health/ready`);
    const readyData = await ready.json();
    assert.ok(ready.status === 200 || ready.status === 503);
    assert.equal(typeof readyData.ok, "boolean");

    console.log("Đã kiểm tra: /health, /health/live, /health/ready.");
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