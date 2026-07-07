const config = require("../config/env");
const logger = require("../utils/logger");

let pubClient = null;
let subClient = null;
let enabled = false;

function isEnabled() {
  return enabled;
}

async function connect() {
  if (!config.redisUrl) {
    logger.info("Redis chưa cấu hình — chạy single-instance in-memory.");
    return null;
  }

  const { createClient } = require("redis");
  pubClient = createClient({ url: config.redisUrl });
  subClient = pubClient.duplicate();

  pubClient.on("error", (error) => {
    logger.error("Redis pub client error", { error: error.message });
  });
  subClient.on("error", (error) => {
    logger.error("Redis sub client error", { error: error.message });
  });

  await Promise.all([pubClient.connect(), subClient.connect()]);
  enabled = true;
  logger.info("Redis connected", { url: config.redisUrl.replace(/:[^:@/]+@/, ":***@") });
  return { pubClient, subClient };
}

async function attachSocketAdapter(io) {
  if (!enabled || !pubClient || !subClient) {
    return false;
  }

  const { createAdapter } = require("@socket.io/redis-adapter");
  io.adapter(createAdapter(pubClient, subClient));
  logger.info("Socket.IO Redis adapter enabled");
  return true;
}

function getClient() {
  return pubClient;
}

async function ping() {
  if (!enabled || !pubClient) {
    return { ok: true, mode: "disabled" };
  }

  try {
    const response = await pubClient.ping();
    return { ok: response === "PONG", mode: "redis" };
  } catch (error) {
    return { ok: false, mode: "redis", error: error.message };
  }
}

async function close() {
  enabled = false;
  const closers = [];
  if (pubClient) closers.push(pubClient.quit().catch(() => {}));
  if (subClient) closers.push(subClient.quit().catch(() => {}));
  await Promise.all(closers);
  pubClient = null;
  subClient = null;
}

module.exports = {
  isEnabled,
  connect,
  attachSocketAdapter,
  getClient,
  ping,
  close
};