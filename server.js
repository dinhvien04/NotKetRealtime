const config = require("./src/config/env");
const app = require("./src/app");
const { closePool } = require("./src/db");
const logger = require("./src/utils/logger");

const configErrors = config.validateProductionConfig();
if (config.isProduction && configErrors.length) {
  for (const err of configErrors) {
    logger.error(err);
  }
  process.exit(1);
}

if (config.isProduction && config.appOpenMode && config.allowPublicDemoUploads) {
  logger.warn(
    "CẢNH BÁO NGHIÊM TRỌNG: APP_OPEN_MODE=true + ALLOW_PUBLIC_DEMO_UPLOADS=true — " +
      "ai có link production cũng có thể upload file lên S3 của bạn."
  );
}

let isShuttingDown = false;

function start() {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return;
  }

  app.listen(config.port, () => {
    logger.info("Server listening", {
      port: config.port,
      env: config.nodeEnv,
      openMode: config.appOpenMode
    });
  });
}

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info("Shutting down", { signal });
  await closePool();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

if (require.main === module) {
  start();
}

module.exports = app;
