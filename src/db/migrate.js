const fs = require("fs");
const path = require("path");
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

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id serial PRIMARY KEY,
      filename varchar(255) UNIQUE NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query(
    "SELECT filename FROM schema_migrations ORDER BY filename"
  );
  return new Set(result.rows.map((row) => row.filename));
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
        if (applied.has(file)) {
          console.log(`Bỏ qua ${file} (đã chạy).`);
          continue;
        }

        const sql = fs.readFileSync(
          path.join(__dirname, "..", "..", "migrations", file),
          "utf8"
        );

        await client.query("BEGIN");
        try {
          await client.query(sql);
          await client.query(
            "INSERT INTO schema_migrations (filename) VALUES ($1)",
            [file]
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