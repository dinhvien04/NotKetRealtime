const config = require("./src/config/env");
const app = require("./src/app");
const { closePool } = require("./src/db");
const logger = require("./src/utils/logger");

if (config.isProduction && config.appOpenMode) {
  logger.warn(
    "CẢNH BÁO: APP_OPEN_MODE=true trong production — ai có link cũng có thể upload lên S3 của bạn."
  );
}

const configErrors = config.validateProductionConfig();
if (config.isProduction && configErrors.length) {
  for (const err of configErrors) {
    logger.error(err);
  }
  process.exit(1);
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
