const assert = require("assert");
const config = require("../src/config/env");

async function run() {
  const saved = {
    APP_OPEN_MODE: process.env.APP_OPEN_MODE,
    ALLOW_PUBLIC_DEMO_UPLOADS: process.env.ALLOW_PUBLIC_DEMO_UPLOADS,
    STORAGE_LIMIT_BYTES: process.env.STORAGE_LIMIT_BYTES,
    MAX_FILE_BYTES: process.env.MAX_FILE_BYTES,
    NODE_ENV: process.env.NODE_ENV,
    APP_ACCESS_KEY: process.env.APP_ACCESS_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    S3_BUCKET: process.env.S3_BUCKET,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY
  };

  try {
    process.env.APP_OPEN_MODE = "true";
    process.env.STORAGE_LIMIT_BYTES = "2048";
    process.env.MAX_FILE_BYTES = "1111";
    assert.equal(config.appOpenMode, true);
    assert.equal(config.storageLimitBytes, 2048);
    assert.equal(config.maxFileBytes, 1111);

    process.env.NODE_ENV = "production";
    process.env.APP_OPEN_MODE = "false";
    process.env.ALLOW_PUBLIC_DEMO_UPLOADS = "false";
    process.env.APP_ACCESS_KEY = "short";
    process.env.DATABASE_URL = "";
    process.env.S3_BUCKET = "";
    process.env.S3_ACCESS_KEY_ID = "";
    process.env.S3_SECRET_ACCESS_KEY = "";

    const prodErrors = config.validateProductionConfig();
    assert.ok(prodErrors.some((e) => /APP_ACCESS_KEY/.test(e)));
    assert.ok(prodErrors.some((e) => /DATABASE_URL/.test(e)));
    assert.ok(prodErrors.some((e) => /S3_BUCKET/.test(e)));

    // production open mode without ALLOW_PUBLIC_DEMO_UPLOADS → fail-fast error
    process.env.APP_OPEN_MODE = "true";
    process.env.ALLOW_PUBLIC_DEMO_UPLOADS = "false";
    process.env.DATABASE_URL = "postgres://x";
    process.env.S3_BUCKET = "b";
    process.env.S3_ACCESS_KEY_ID = "a";
    process.env.S3_SECRET_ACCESS_KEY = "s";
    process.env.APP_ACCESS_KEY = "";

    const openBlocked = config.validateProductionConfig();
    assert.ok(openBlocked.some((e) => /ALLOW_PUBLIC_DEMO_UPLOADS/.test(e)));

    // explicit demo opt-in allows open mode (still may warn at runtime)
    process.env.ALLOW_PUBLIC_DEMO_UPLOADS = "true";
    const openAllowed = config.validateProductionConfig();
    assert.ok(!openAllowed.some((e) => /ALLOW_PUBLIC_DEMO_UPLOADS/.test(e)));
  } finally {
    Object.entries(saved).forEach(([k, v]) => {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    });
  }

  console.log("env-config.test.js OK");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
