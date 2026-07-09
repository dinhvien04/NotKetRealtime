require("dotenv").config();

function parseBooleanEnv(raw, fallback = false) {
  if (raw === undefined || raw === "") return fallback;
  if (raw === "false" || raw === "0") return false;
  return raw === "true" || raw === "1";
}

function getMaxUploadBytes() {
  const value = Number(process.env.MAX_UPLOAD_BYTES) || 6291456;
  return Number.isFinite(value) ? value : 6291456;
}

function validateProductionConfig() {
  const errors = [];
  const isProduction = process.env.NODE_ENV === "production";
  const openMode = parseBooleanEnv(process.env.APP_OPEN_MODE, false);
  const allowPublicDemo = parseBooleanEnv(
    process.env.ALLOW_PUBLIC_DEMO_UPLOADS,
    false
  );

  if (!process.env.DATABASE_URL) {
    errors.push("Thiếu DATABASE_URL.");
  }

  if (!process.env.S3_BUCKET) {
    errors.push("Thiếu S3_BUCKET.");
  }
  if (!process.env.S3_ACCESS_KEY_ID) {
    errors.push("Thiếu S3_ACCESS_KEY_ID.");
  }
  if (!process.env.S3_SECRET_ACCESS_KEY) {
    errors.push("Thiếu S3_SECRET_ACCESS_KEY.");
  }

  if (isProduction && openMode && !allowPublicDemo) {
    errors.push(
      "Production với APP_OPEN_MODE=true bị chặn mặc định. " +
        "Ai có link cũng có thể upload lên S3. " +
        "Chỉ bật khi cố ý demo công khai bằng ALLOW_PUBLIC_DEMO_UPLOADS=true."
    );
  }

  if (isProduction && !openMode) {
    const key = process.env.APP_ACCESS_KEY || "";
    if (key.length < 32) {
      errors.push(
        "Production với APP_OPEN_MODE=false yêu cầu APP_ACCESS_KEY dài tối thiểu 32 ký tự."
      );
    }
  }

  return errors;
}

const config = {
  parseBooleanEnv,
  get databaseUrl() {
    return process.env.DATABASE_URL || "";
  },
  get migrationDatabaseUrl() {
    return process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL || "";
  },
  get clientOrigin() {
    return process.env.CLIENT_ORIGIN || "http://localhost:3000";
  },
  get clientOrigins() {
    const raw = process.env.CLIENT_ORIGIN || "http://localhost:3000";
    return raw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  },
  get storageProvider() {
    return (process.env.STORAGE_PROVIDER || "s3").toLowerCase();
  },
  get s3Region() {
    if (process.env.S3_REGION) {
      return process.env.S3_REGION;
    }
    if (process.env.S3_ENDPOINT) {
      return "auto";
    }
    return "ap-southeast-1";
  },
  get s3Bucket() {
    return process.env.S3_BUCKET || "";
  },
  get s3AccessKeyId() {
    return process.env.S3_ACCESS_KEY_ID || "";
  },
  get s3SecretAccessKey() {
    return process.env.S3_SECRET_ACCESS_KEY || "";
  },
  get s3Endpoint() {
    return process.env.S3_ENDPOINT || "";
  },
  get s3ForcePathStyle() {
    return parseBooleanEnv(process.env.S3_FORCE_PATH_STYLE, false);
  },
  get s3PublicBaseUrl() {
    return process.env.S3_PUBLIC_BASE_URL || "";
  },
  get s3SignedUrlTtlSeconds() {
    const value = Number(process.env.S3_SIGNED_URL_TTL_SECONDS) || 3600;
    return Number.isFinite(value) ? value : 3600;
  },
  get s3PresignedUploadTtlSeconds() {
    const value = Number(process.env.S3_PRESIGNED_UPLOAD_TTL_SECONDS) || 300;
    return Number.isFinite(value) ? value : 300;
  },
  get maxUploadBytes() {
    return getMaxUploadBytes();
  },
  get maxImageBytes() {
    const value = Number(process.env.MAX_IMAGE_BYTES) || getMaxUploadBytes();
    return Number.isFinite(value) ? value : getMaxUploadBytes();
  },
  get maxFileBytes() {
    const value = Number(process.env.MAX_FILE_BYTES) || 10485760;
    return Number.isFinite(value) ? value : 10485760;
  },
  get storageLimitBytes() {
    const value = Number(process.env.STORAGE_LIMIT_BYTES) || 1073741824;
    return Number.isFinite(value) ? value : 1073741824;
  },
  get appOpenMode() {
    return parseBooleanEnv(process.env.APP_OPEN_MODE, false);
  },
  get allowPublicDemoUploads() {
    return parseBooleanEnv(process.env.ALLOW_PUBLIC_DEMO_UPLOADS, false);
  },
  get appAccessKey() {
    return process.env.APP_ACCESS_KEY || "";
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
  get logLevel() {
    const level = String(process.env.LOG_LEVEL || "info").toLowerCase();
    return ["debug", "info", "warn", "error"].includes(level) ? level : "info";
  },
  get dbPoolMax() {
    const value = Number(process.env.DB_POOL_MAX) || 10;
    return Number.isFinite(value) ? value : 10;
  },
  get dbStatementTimeoutMs() {
    const value = Number(process.env.DB_STATEMENT_TIMEOUT_MS) || 10000;
    return Number.isFinite(value) ? value : 10000;
  },
  validateProductionConfig
};

module.exports = config;
