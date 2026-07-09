process.env.APP_OPEN_MODE = "false";
process.env.APP_ACCESS_KEY = "test-access-key-32-chars-minimum!!";

const assert = require("assert");
const appAccess = require("../src/middlewares/app-access.middleware");

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

function runMiddleware(headers = {}, env = {}) {
  const prevOpen = process.env.APP_OPEN_MODE;
  const prevKey = process.env.APP_ACCESS_KEY;
  if (env.openMode !== undefined) process.env.APP_OPEN_MODE = env.openMode;
  if (env.key !== undefined) process.env.APP_ACCESS_KEY = env.key;

  // reload config by clearing cache is hard; middleware reads config getters live from env via config object
  // env.js uses process.env at get time, so OK.

  let nextCalled = false;
  const req = {
    get(name) {
      return headers[name] || headers[name.toLowerCase()] || "";
    }
  };
  const res = mockRes();
  appAccess(req, res, () => {
    nextCalled = true;
  });

  process.env.APP_OPEN_MODE = prevOpen;
  process.env.APP_ACCESS_KEY = prevKey;

  return { nextCalled, res };
}

async function run() {
  // open mode
  {
    const { nextCalled, res } = runMiddleware({}, { openMode: "true", key: "" });
    assert.equal(nextCalled, true);
    assert.notEqual(res.statusCode, 401);
  }

  // protected missing key
  {
    const { nextCalled, res } = runMiddleware(
      {},
      { openMode: "false", key: "test-access-key-32-chars-minimum!!" }
    );
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.ok, false);
  }

  // wrong key
  {
    const { nextCalled, res } = runMiddleware(
      { "X-App-Access-Key": "wrong-key-wrong-key-wrong-key-wrong" },
      { openMode: "false", key: "test-access-key-32-chars-minimum!!" }
    );
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  }

  // correct key
  {
    const key = "test-access-key-32-chars-minimum!!";
    const { nextCalled } = runMiddleware(
      { "X-App-Access-Key": key },
      { openMode: "false", key }
    );
    assert.equal(nextCalled, true);
  }

  // timing-safe different lengths does not crash
  {
    assert.doesNotThrow(() => {
      appAccess.safeEqual("abc", "abcdef");
      appAccess.safeEqual("", "x");
      appAccess.safeEqual("same", "same");
    });
    assert.equal(appAccess.safeEqual("same", "same"), true);
    assert.equal(appAccess.safeEqual("same", "diff"), false);
  }

  console.log("app-access.middleware.test.js OK");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
