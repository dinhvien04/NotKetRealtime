const { Pool } = require("pg");
const config = require("../config/env");

let pool = null;

function getDatabaseError() {
  if (!config.databaseUrl) {
    return "Thiếu DATABASE_URL. Vui lòng cấu hình connection string Neon Postgres.";
  }
  return null;
}

function getPool() {
  const configError = getDatabaseError();
  if (configError) {
    throw new Error(configError);
  }

  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
      max: 10,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000
    });
  }

  return pool;
}

async function query(text, params = []) {
  const result = await getPool().query(text, params);
  return result;
}

async function withTransaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function closePool() {
  if (!pool) {
    return;
  }

  const currentPool = pool;
  pool = null;

  await Promise.race([
    currentPool.end(),
    new Promise((resolve) => setTimeout(resolve, 5000))
  ]);
}

module.exports = {
  query,
  withTransaction,
  getPool,
  getDatabaseError,
  closePool
};