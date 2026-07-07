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
  get migrationDatabaseUrl() {
    return process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL || "";
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
  get csrfCookieName() {
    return process.env.CSRF_COOKIE_NAME || "notket_csrf";
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
  get maxImageBytes() {
    const value = Number(process.env.MAX_IMAGE_BYTES) || getMaxUploadBytes();
    return Number.isFinite(value) ? value : getMaxUploadBytes();
  },
  get maxVoiceBytes() {
    const value = Number(process.env.MAX_VOICE_BYTES) || 10485760;
    return Number.isFinite(value) ? value : 10485760;
  },
  get maxVoiceSeconds() {
    const value = Number(process.env.MAX_VOICE_SECONDS) || 120;
    return Number.isFinite(value) ? value : 120;
  },
  get supabaseStoragePublic() {
    const raw = process.env.SUPABASE_STORAGE_PUBLIC;
    if (raw === undefined || raw === "") return true;
    return raw === "true" || raw === "1";
  },
  get signedUrlTtlSeconds() {
    const value = Number(process.env.SIGNED_URL_TTL_SECONDS) || 3600;
    return Number.isFinite(value) ? value : 3600;
  },
  get nodeEnv() {
    return process.env.NODE_ENV || "development";
  },
  get port() {
    return Number(process.env.PORT) || 3000;
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get appBaseUrl() {
    return process.env.APP_BASE_URL || "http://localhost:3000";
  },
  get smtpHost() {
    return process.env.SMTP_HOST || "";
  },
  get smtpPort() {
    return Number(process.env.SMTP_PORT) || 587;
  },
  get smtpUser() {
    return process.env.SMTP_USER || "";
  },
  get smtpPass() {
    return process.env.SMTP_PASS || "";
  },
  get smtpFrom() {
    return process.env.SMTP_FROM || "";
  },
  get passwordResetOtpTtlMinutes() {
    const value = Number(process.env.PASSWORD_RESET_OTP_TTL_MINUTES) || 10;
    return Number.isFinite(value) ? value : 10;
  },
  get otpPepper() {
    return process.env.OTP_PEPPER || process.env.JWT_SECRET || "";
  },
  get maxAvatarBytes() {
    const value = Number(process.env.MAX_AVATAR_BYTES) || 2097152;
    return Number.isFinite(value) ? value : 2097152;
  },
  get messageEditWindowMinutes() {
    const value = Number(process.env.MESSAGE_EDIT_WINDOW_MINUTES) || 15;
    return Number.isFinite(value) ? value : 15;
  }
};