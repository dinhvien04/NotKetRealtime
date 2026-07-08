const http = require("http");
const { Server } = require("socket.io");
const config = require("./src/config/env");
const authService = require("./src/services/auth.service");
const app = require("./src/app");
const registerSocketController = require("./src/controllers/socket.controller");
const realtimeService = require("./src/services/realtime.service");
const redisService = require("./src/services/redis.service");
const { closePool } = require("./src/db");
const logger = require("./src/utils/logger");
const { socketAuthMiddleware } = require("./src/middlewares/socket-auth.middleware");
const {
  socketOriginMiddleware,
  createSocketCorsOriginChecker
} = require("./src/middlewares/socket-origin.middleware");

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  serveClient: true, // Enable serving client script locally
  cors: {
    origin: createSocketCorsOriginChecker(),
    credentials: true
  }
});

io.use(socketOriginMiddleware);
io.use(socketAuthMiddleware);
realtimeService.setIo(io);
registerSocketController(io);

const authConfigError = authService.getAuthConfigError();
if (authConfigError) {
  logger.error(authConfigError);
  process.exit(1);
}

let isShuttingDown = false;

async function start() {
  try {
    await redisService.connect();
    await redisService.attachSocketAdapter(io);

    // Only listen if not running in Vercel serverless (or other serverless env)
    if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
      httpServer.listen(config.port, () => {
        logger.info("Server started", {
          port: config.port,
          redis: redisService.isEnabled(),
          env: config.nodeEnv
        });
      });
    }
  } catch (error) {
    logger.error("Không thể khởi động server", { error: error.message });
    if (!process.env.VERCEL) {
      process.exit(1);
    }
  }
}

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info("Shutting down", { signal });

  await new Promise((resolve) => {
    io.close(() => resolve());
  });

  await new Promise((resolve) => {
    httpServer.close(() => resolve());
  });

  await redisService.close();
  await closePool();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// For local / traditional hosting
if (require.main === module) {
  start();
}

// Export express app for serverless platforms (Vercel, etc.)
// Note: Full Socket.IO support on serverless has limitations (use dedicated hosting for production realtime)
module.exports = app;