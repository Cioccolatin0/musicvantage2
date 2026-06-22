const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://musicvantage2:musicvantage2@localhost:5432/musicvantage2'
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

CREATE TABLE IF NOT EXISTS social_users (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  color    TEXT NOT NULL DEFAULT '#7c3aed',
  created  BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS friendships (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester UUID NOT NULL REFERENCES social_users(id) ON DELETE CASCADE,
  addressee UUID NOT NULL REFERENCES social_users(id) ON DELETE CASCADE,
  status    TEXT NOT NULL DEFAULT 'pending',
  created   BIGINT NOT NULL,
  UNIQUE(requester, addressee)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room     TEXT NOT NULL,
  sender   UUID NOT NULL REFERENCES social_users(id) ON DELETE CASCADE,
  text     TEXT NOT NULL,
  created  BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS jam_sessions (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host      UUID NOT NULL REFERENCES social_users(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  active    BOOLEAN NOT NULL DEFAULT TRUE,
  track_id  TEXT,
  position  REAL NOT NULL DEFAULT 0,
  playing   BOOLEAN NOT NULL DEFAULT FALSE,
  created   BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS jam_participants (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session  UUID NOT NULL REFERENCES jam_sessions(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES social_users(id) ON DELETE CASCADE,
  UNIQUE(session, user_id)
);

CREATE TABLE IF NOT EXISTS shared_playlists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner      UUID NOT NULL REFERENCES social_users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  tracks     JSONB NOT NULL DEFAULT '[]',
  created    BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_shares (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist   UUID NOT NULL REFERENCES shared_playlists(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES social_users(id) ON DELETE CASCADE,
  can_edit   BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(playlist, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES social_users(id) ON DELETE CASCADE,
  type    TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  read    BOOLEAN NOT NULL DEFAULT FALSE,
  created BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS referral_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES social_users(id) ON DELETE CASCADE,
  code       TEXT UNIQUE NOT NULL,
  used_by    UUID REFERENCES social_users(id),
  created    BIGINT NOT NULL
);

ALTER TABLE social_users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
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
