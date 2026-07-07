const config = require("../config/env");
const { getDatabaseError, query } = require("../db");
const redisService = require("../services/redis.service");

const startedAt = Date.now();

async function pingDatabase() {
  const configError = getDatabaseError();
  if (configError) {
    return { ok: false, mode: "disabled", error: configError };
  }

  try {
    await query("SELECT 1");
    return { ok: true, mode: "postgres" };
  } catch (error) {
    return { ok: false, mode: "postgres", error: error.message };
  }
}

async function buildHealth(statusCodeWhenDegraded = 200) {
  const database = await pingDatabase();
  const redis = await redisService.ping();
  const ok = database.ok;

  return {
    statusCode: ok ? 200 : statusCodeWhenDegraded,
    body: {
      ok,
      uptimeSeconds: Math.round(process.uptime()),
      startedAt,
      environment: config.nodeEnv,
      services: {
        database,
        redis
      }
    }
  };
}

async function live(req, res) {
  return res.json({
    ok: true,
    uptimeSeconds: Math.round(process.uptime())
  });
}

async function ready(req, res) {
  const health = await buildHealth(503);
  return res.status(health.statusCode).json(health.body);
}

async function health(req, res) {
  const result = await buildHealth(503);
  return res.status(result.statusCode).json(result.body);
}

module.exports = {
  live,
  ready,
  health
};