const config = require("../config/env");

function getAllowedSocketOrigins() {
  const origins = new Set([
    config.clientOrigin,
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ]);

  if (config.port) {
    origins.add(`http://localhost:${config.port}`);
    origins.add(`http://127.0.0.1:${config.port}`);
  }

  return origins;
}

function isAllowedSocketOrigin(origin) {
  if (!origin) {
    return !config.isProduction;
  }
  return getAllowedSocketOrigins().has(origin);
}

function socketOriginMiddleware(socket, next) {
  if (!config.isProduction) {
    return next();
  }

  const origin = socket.handshake.headers.origin;
  if (!isAllowedSocketOrigin(origin)) {
    return next(new Error("Forbidden origin"));
  }

  return next();
}

function createSocketCorsOriginChecker() {
  const allowed = getAllowedSocketOrigins();
  return (origin, callback) => {
    if (!origin || allowed.has(origin)) {
      callback(null, true);
      return;
    }
    if (!config.isProduction) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed by Socket.IO CORS"));
  };
}

module.exports = {
  socketOriginMiddleware,
  createSocketCorsOriginChecker,
  getAllowedSocketOrigins,
  isAllowedSocketOrigin
};