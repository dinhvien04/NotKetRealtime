require("dotenv").config();

function parseDurationMs(value, fallbackMs) {
  if (!value) return fallbackMs;
  const match = /^(\d+)([dhms])$/i.exec(value.trim());
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return amount * (multipliers[unit] || 86400000);
}

function getMaxUploadBytes() {
  const value = Number(process.env.MAX_UPLOAD_BYTES) || 6291456;
  return Number.isFinite(value) ? value : 6291456;
}

module.exports = {
  get databaseUrl() {
    return process.env.DATABASE_URL || "";
  },
  get jwtSecret() {
    return process.env.JWT_SECRET || "";
  },
  get jwtExpiresIn() {
    return process.env.JWT_EXPIRES_IN || "7d";
  },
  get jwtMaxAgeMs() {
    return parseDurationMs(process.env.JWT_EXPIRES_IN, 7 * 86400000);
  },
  get cookieName() {
    return process.env.COOKIE_NAME || "notket_token";
  },
  get clientOrigin() {
    return process.env.CLIENT_ORIGIN || "http://localhost:3000";
  },
  get supabaseUrl() {
    return (
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    );
  },
  get supabasePublishableKey() {
    return (
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      ""
    );
  },
  get supabaseServerKey() {
    return (
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      ""
    );
  },
  get supabaseStorageBucket() {
    return process.env.SUPABASE_STORAGE_BUCKET || "chat-uploads";
  },
  get maxUploadBytes() {
    return getMaxUploadBytes();
  },
  get nodeEnv() {
    return process.env.NODE_ENV || "development";
  },
  get port() {
    return Number(process.env.PORT) || 3000;
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  }
};