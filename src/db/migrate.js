const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const config = require("../config/env");

function getMigrationDatabaseError() {
  if (!config.migrationDatabaseUrl) {
    return "Thiếu MIGRATION_DATABASE_URL hoặc DATABASE_URL. Vui lòng cấu hình connection string Postgres.";
  }
  return null;
}

function createMigrationPool() {
  const connectionString = config.migrationDatabaseUrl;
  return new Pool({
    connectionString,
    ssl: connectionString.includes("localhost")
      ? false
      : { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000
  });
}

function listMigrationFiles() {
  const migrationsDir = path.join(__dirname, "..", "..", "migrations");
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

function checksumFor(sql) {
  return crypto.createHash("sha256").update(sql, "utf8").digest("hex");
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename varchar(255) PRIMARY KEY,
      version text,
      checksum text,
      executed_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    ALTER TABLE schema_migrations
    ADD COLUMN IF NOT EXISTS version text
  `);
  await client.query(`
    ALTER TABLE schema_migrations
    ADD COLUMN IF NOT EXISTS checksum text
  `);
  await client.query(`
    ALTER TABLE schema_migrations
    ADD COLUMN IF NOT EXISTS executed_at timestamptz NOT NULL DEFAULT now()
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query(
    "SELECT filename, checksum FROM schema_migrations ORDER BY filename"
  );
  return new Map(result.rows.map((row) => [row.filename, row.checksum || null]));
}

async function runMigrations() {
  const configError = getMigrationDatabaseError();
  if (configError) {
    console.error(configError);
    process.exitCode = 1;
    return;
  }

  const pool = createMigrationPool();
  const files = listMigrationFiles();

  try {
    const client = await pool.connect();
    try {
      await ensureMigrationsTable(client);
      const applied = await getAppliedMigrations(client);

      for (const file of files) {
        const sql = fs.readFileSync(
          path.join(__dirname, "..", "..", "migrations", file),
          "utf8"
        );
        const checksum = checksumFor(sql);
        const version = file.replace(/\.sql$/, "");

        if (applied.has(file)) {
          const previousChecksum = applied.get(file);
          if (previousChecksum && previousChecksum !== checksum) {
            throw new Error(
              `Checksum migration ${file} đã thay đổi. Không thể chạy lại migration đã apply.`
            );
          }
          console.log(`Bỏ qua ${file} (đã chạy).`);
          continue;
        }

        await client.query("BEGIN");
        try {
          await client.query(sql);
          await client.query(
            `INSERT INTO schema_migrations (version, filename, checksum)
             VALUES ($1, $2, $3)`,
            [version, file, checksum]
          );
          await client.query("COMMIT");
          console.log(`Migration ${file} hoàn tất.`);
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Migration thất bại:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

async function showStatus() {
  const configError = getMigrationDatabaseError();
  if (configError) {
    console.error(configError);
    process.exitCode = 1;
    return;
  }

  const pool = createMigrationPool();
  const files = listMigrationFiles();

  try {
    const client = await pool.connect();
    try {
      await ensureMigrationsTable(client);
      const applied = await getAppliedMigrations(client);

      console.log("Migration status:");
      for (const file of files) {
        console.log(`- ${applied.has(file) ? "[x]" : "[ ]"} ${file}`);
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Không thể đọc migration status:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (process.argv.includes("--status")) {
  showStatus();
} else {
  runMigrations();
}