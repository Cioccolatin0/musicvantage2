const crypto = require('crypto');
const db = require('./db');

const ADMIN_SESSION_TTL = 24 * 60 * 60 * 1000;

const sessions = {};

async function ensureInitialSetup() {
  let adminPassword = await db.getConfig('adminPassword');
  if (!adminPassword) {
    adminPassword = crypto.randomBytes(4).toString('hex');
    await db.setConfig('adminPassword', adminPassword);
    const { rows } = await db.query('SELECT key FROM apps WHERE name = $1', ['web-ui']);
    if (rows.length === 0) {
      const webKey = crypto.randomUUID();
      await db.query(
        'INSERT INTO apps (name, key, created, revoked) VALUES ($1, $2, $3, $4) ON CONFLICT (name) DO NOTHING',
        ['web-ui', webKey, Date.now(), false]
      );
    }
    console.log('');
    console.log('='.repeat(50));
    console.log('  SOUNDUSIC ADMIN PANEL');
    console.log('='.repeat(50));
    console.log(`  URL:   http://localhost:${process.env.PORT || 3001}/admin`);
    console.log(`  Password: ${adminPassword}`);
    console.log('='.repeat(50));
    console.log('');
  }
}

async function getWebKey() {
  const { rows } = await db.query('SELECT key FROM apps WHERE name = $1 AND revoked = false', ['web-ui']);
  return rows[0]?.key || null;
}

async function validateApiKey(key) {
  if (!key) return null;
  const { rows } = await db.query('SELECT name FROM apps WHERE key = $1 AND revoked = false', [key]);
  return rows[0]?.name || null;
}

function createSession() {
  const token = crypto.randomUUID();
  sessions[token] = { expires: Date.now() + ADMIN_SESSION_TTL };
  return token;
}

function validateSession(token) {
  const s = sessions[token];
  if (!s) return false;
  if (Date.now() > s.expires) {
    delete sessions[token];
    return false;
  }
  return true;
}

async function validateAdminPassword(password) {
  const stored = await db.getConfig('adminPassword');
  return stored === password;
}

function extractApiKey(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  if (req.query.key) return req.query.key;
  return null;
}

function extractSessionToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  if (req.query.token) return req.query.token;
  return null;
}

async function apiKeyMiddleware(req, res, next) {
  const skip = ['/api/config', '/api/admin/login'];
  const p = req.baseUrl + req.path;
  if (skip.some(s => p.startsWith(s))) return next();
  if (req.path.startsWith('/admin/')) {
    const token = extractSessionToken(req);
    if (!validateSession(token)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return next();
  }
  const key = extractApiKey(req);
  const appName = await validateApiKey(key);
  if (!appName) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  next();
}

async function listApps() {
  const { rows } = await db.query('SELECT name, key, created, revoked FROM apps ORDER BY created');
  return rows;
}

async function createApp(name) {
  const { rows } = await db.query('SELECT id FROM apps WHERE name = $1', [name]);
  if (rows.length > 0) return null;
  const key = crypto.randomUUID();
  await db.query(
    'INSERT INTO apps (name, key, created, revoked) VALUES ($1, $2, $3, $4)',
    [name, key, Date.now(), false]
  );
  return key;
}

async function revokeApp(name) {
  if (name === 'web-ui') return false;
  const { rowCount } = await db.query('DELETE FROM apps WHERE name = $1', [name]);
  return rowCount > 0;
}

async function changeAdminPassword(oldPwd, newPwd) {
  const stored = await db.getConfig('adminPassword');
  if (stored !== oldPwd) return false;
  await db.setConfig('adminPassword', newPwd);
  return true;
}

module.exports = {
  ensureInitialSetup,
  apiKeyMiddleware,
  getWebKey,
  validateAdminPassword,
  createSession,
  validateSession,
  listApps,
  createApp,
  revokeApp,
  changeAdminPassword
};
