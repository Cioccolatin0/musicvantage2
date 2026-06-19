const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://soundusic:soundusic@localhost:5432/soundusic'
});

pool.on('error', err => {
  console.error('PostgreSQL pool error:', err.message);
});

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS apps (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name    TEXT UNIQUE NOT NULL,
  key     TEXT NOT NULL,
  created BIGINT NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS sessions (
  token   TEXT PRIMARY KEY,
  expires BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS playlists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  source     TEXT,
  source_url TEXT,
  tracks     JSONB NOT NULL DEFAULT '[]',
  created    BIGINT NOT NULL
);
`;

async function initDb() {
  await pool.query(SCHEMA_SQL);
  console.log('PostgreSQL schema ready');
}

async function query(text, params) {
  return pool.query(text, params);
}

async function getConfig(key) {
  const { rows } = await pool.query('SELECT value FROM config WHERE key = $1', [key]);
  return rows[0]?.value || null;
}

async function setConfig(key, value) {
  await pool.query(
    'INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
    [key, value]
  );
}

module.exports = { pool, initDb, query, getConfig, setConfig };
