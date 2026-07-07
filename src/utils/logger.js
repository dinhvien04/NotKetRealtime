const config = require("../config/env");

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function shouldLog(level) {
  const current = LEVELS[config.logLevel] || LEVELS.info;
  const target = LEVELS[level] || LEVELS.info;
  return target >= current;
}

function write(level, message, meta = {}) {
  if (!shouldLog(level)) return;

  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    ...meta
  };

  if (config.isProduction) {
    const line = JSON.stringify(entry);
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
    return;
  }

  const prefix = `[${entry.time}] ${level.toUpperCase()}`;
  const payload = Object.keys(meta).length ? meta : "";
  if (level === "error") {
    console.error(prefix, message, payload);
  } else if (level === "warn") {
    console.warn(prefix, message, payload);
  } else {
    console.log(prefix, message, payload);
  }
}

module.exports = {
  debug(message, meta) {
    write("debug", message, meta);
  },
  info(message, meta) {
    write("info", message, meta);
  },
  warn(message, meta) {
    write("warn", message, meta);
  },
  error(message, meta) {
    write("error", message, meta);
  }
};