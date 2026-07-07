const fs = require("fs");
const path = require("path");
const { getPool, getDatabaseError } = require("./index");

async function migrate() {
  const configError = getDatabaseError();
  if (configError) {
    console.error(configError);
    process.exitCode = 1;
    return;
  }

  const migrationPath = path.join(
    __dirname,
    "..",
    "..",
    "migrations",
    "001_init.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8");
  const pool = getPool();

  try {
    await pool.query(sql);
    console.log("Migration 001_init.sql hoàn tất.");
  } catch (error) {
    console.error("Migration thất bại:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();