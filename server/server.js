require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { search: ytMusicSearch, getVideoInfo: ytMusicInfo, getLyrics } = require('./ytmusic');
const ytdlp = require('./ytdlp');
const auth = require('./auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/config', async (req, res) => {
  const key = await auth.getWebKey();
  res.json({ key });
});

app.use('/api', auth.apiKeyMiddleware);

app.get('/api/search', async (req, res) => {
  try {
    const q = req.query.q;
    const type = req.query.type || 'all';
    if (!q) return res.status(400).json({ error: 'Query required' });
    req.setTimeout(30000);
    let results;
    try {
      results = await ytMusicSearch(q, type);
    } catch {
      results = await ytdlp.search(q, type);
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/info/:id', async (req, res) => {
  try {
    let info;
    try {
      info = await ytMusicInfo(req.params.id);
    } catch {
      info = await ytdlp.getVideoInfo(req.params.id);
    }
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lyrics/:id', async (req, res) => {
  try {
    const lyrics = await getLyrics(req.params.id);
    if (lyrics) res.json({ lyrics });
    else res.status(404).json({ error: 'Lyrics not found' });
  } catch {
    res.status(500).json({ error: 'Lyrics error' });
  }
});

app.get('/api/stream/:id', async (req, res) => {
  try {
    req.setTimeout(60000);
    const url = await ytdlp.getStreamUrl(req.params.id);
    if (url) res.redirect(url);
    else res.status(404).json({ error: 'Stream not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stream/url/:id', async (req, res) => {
  try {
    const url = await ytdlp.getStreamUrl(req.params.id);
    if (url) res.json({ url });
    else res.status(404).json({ error: 'Stream not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stream/prefetch', async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) return res.json({ ok: false });
  res.json({ ok: true });
  for (const id of ids) {
    ytdlp.getStreamUrl(id).catch(() => {});
  }
});

// === IMPORT / PLAYLIST ROUTES ===
const importer = require('./importer');

app.post('/api/import', async (req, res) => {
  try {
    const { url, tracks } = req.body;
    const playlist = await importer.importPlaylist({ url, tracks });
    res.json(playlist);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/playlists', async (req, res) => {
  const list = await importer.listPlaylists();
  res.json(list);
});

app.get('/api/playlists/:id', async (req, res) => {
  const pl = await importer.loadPlaylist(req.params.id);
  if (!pl) return res.status(404).json({ error: 'Playlist not found' });
  res.json(pl);
});

app.delete('/api/playlists/:id', async (req, res) => {
  const ok = await importer.deletePlaylist(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Playlist not found' });
  res.json({ ok: true });
});

// === ADMIN ROUTES ===
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  const valid = await auth.validateAdminPassword(password);
  if (valid) {
    const token = auth.createSession();
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.get('/api/admin/apps', async (req, res) => {
  const apps = await auth.listApps();
  res.json(apps);
});

app.post('/api/admin/apps', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
  const key = await auth.createApp(name.trim());
  if (!key) return res.status(409).json({ error: 'App already exists' });
  res.json({ name: name.trim(), key });
});

app.delete('/api/admin/apps/:name', async (req, res) => {
  const ok = await auth.revokeApp(req.params.name);
  if (!ok) return res.status(404).json({ error: 'App not found or cannot be deleted' });
  res.json({ ok: true });
});

app.post('/api/admin/change-password', async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const changed = await auth.changeAdminPassword(oldPassword, newPassword);
  if (!changed) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, '..', 'web', 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'dist', 'index.html'));
});

process.stdout.on('error', () => {});
process.stderr.on('error', () => {});

const db = require('./db');
db.initDb().then(() => auth.ensureInitialSetup()).then(() => {
  app.listen(PORT, () => {
    console.log(`Soundusic server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});
