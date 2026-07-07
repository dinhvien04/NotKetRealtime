const config = require("../config/env");

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const REDACTED = "[REDACTED]";

const SENSITIVE_PATTERNS = [
  /(key=)[^&\s"']+/gi,
  /(api_key=)[^&\s"']+/gi,
  /(token=)[^&\s"']+/gi,
  /(authorization\s*[:=]\s*)([^\s,;]+)/gi,
  /(cookie\s*[:=]\s*)([^\s,;]+)/gi,
  /(set-cookie\s*[:=]\s*)([^\s,;]+)/gi,
  /(DATABASE_URL\s*[:=]\s*)([^\s,;]+)/gi,
  /(JWT_SECRET\s*[:=]\s*)([^\s,;]+)/gi,
  /(SUPABASE_SECRET_KEY\s*[:=]\s*)([^\s,;]+)/gi,
  /(GEMINI_API_KEY\s*[:=]\s*)([^\s,;]+)/gi
];

function redactString(value) {
  if (typeof value !== "string" || !value) {
    return value;
  }

  let redacted = value;
  for (const pattern of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, `$1${REDACTED}`);
  }
  return redacted;
}

function redactValue(value) {
  if (typeof value === "string") {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (value && typeof value === "object") {
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      const lowered = key.toLowerCase();
      if (
        lowered.includes("authorization") ||
        lowered.includes("cookie") ||
        lowered.includes("token") ||
        lowered.includes("secret") ||
        lowered.includes("password") ||
        lowered.includes("api_key") ||
        lowered.includes("apikey")
      ) {
        output[key] = REDACTED;
      } else {
        output[key] = redactValue(entry);
      }
    }
    return output;
  }

  return value;
}

function shouldLog(level) {
  const current = LEVELS[config.logLevel] || LEVELS.info;
  const target = LEVELS[level] || LEVELS.info;
  return target >= current;
}

function write(level, message, meta = {}) {
  if (!shouldLog(level)) return;

  const entry = {
    level,
    message: redactString(message),
    time: new Date().toISOString(),
    ...redactValue(meta)
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
  const payload = Object.keys(meta).length ? redactValue(meta) : "";
  if (level === "error") {
    console.error(prefix, entry.message, payload);
  } else if (level === "warn") {
    console.warn(prefix, entry.message, payload);
  } else {
    console.log(prefix, entry.message, payload);
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
  },
  redactString,
  redactValue
};