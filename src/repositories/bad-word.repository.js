const { query } = require("../db");

function mapRow(row) {
  return {
    id: row.id,
    word: row.word,
    severity: row.severity,
    replacement: row.replacement,
    createdBy: row.created_by || null,
    createdAt: row.created_at
  };
}

async function listAll() {
  const result = await query(
    `SELECT * FROM bad_words ORDER BY lower(word) ASC`
  );
  return result.rows.map(mapRow);
}

async function list({ q = "", page = 1, pageSize = 50 } = {}) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeSize = Math.min(Math.max(Number(pageSize) || 50, 1), 100);
  const offset = (safePage - 1) * safeSize;
  const params = [];
  let whereSql = "";

  if (q) {
    params.push(`%${String(q).trim().toLowerCase()}%`);
    whereSql = `WHERE lower(word) LIKE $1`;
  }

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM bad_words ${whereSql}`,
    params
  );

  params.push(safeSize, offset);
  const limitIndex = params.length - 1;
  const offsetIndex = params.length;
  const result = await query(
    `SELECT * FROM bad_words ${whereSql}
     ORDER BY lower(word) ASC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    params
  );

  return {
    items: result.rows.map(mapRow),
    total: countResult.rows[0]?.total || 0,
    page: safePage,
    pageSize: safeSize
  };
}

async function findById(id) {
  const result = await query(`SELECT * FROM bad_words WHERE id = $1`, [id]);
  const row = result.rows[0];
  return row ? mapRow(row) : null;
}

async function findByWord(word) {
  const result = await query(
    `SELECT * FROM bad_words WHERE lower(word) = lower($1) LIMIT 1`,
    [word]
  );
  const row = result.rows[0];
  return row ? mapRow(row) : null;
}

async function create({ word, severity, replacement, createdBy }) {
  const result = await query(
    `INSERT INTO bad_words (word, severity, replacement, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [word, severity, replacement, createdBy || null]
  );
  return mapRow(result.rows[0]);
}

async function remove(id) {
  const result = await query(
    `DELETE FROM bad_words WHERE id = $1 RETURNING *`,
    [id]
  );
  const row = result.rows[0];
  return row ? mapRow(row) : null;
}

module.exports = {
  listAll,
  list,
  findById,
  findByWord,
  create,
  remove
};