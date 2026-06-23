require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { search: ytMusicSearch, getVideoInfo: ytMusicInfo, getLyrics, getStreamUrl: ytMusicStreamUrl, getArtistInfo, getRelatedTracks } = require('./ytmusic');
const ytdlp = require('./ytdlp');
const auth = require('./auth');
const social = require('./social');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Public API ---
app.get('/api/config', async (req, res) => {
  const key = await auth.getWebKey();
  res.json({ key });
});

app.get('/api/debug/search', async (req, res) => {
  try {
    const q = req.query.q || 'test';
    const { getInnertube } = require('./ytmusic');
    const yt = await getInnertube();
    const results = await yt.music.search(q);
    const sections = [];
    for (const section of results.contents || []) {
      const sectionInfo = {
        title: (section.title || '').toString(),
        type: section.type,
        itemCount: section.contents ? section.contents.length : 0,
        items: []
      };
      if (section.contents) {
        for (const item of section.contents) {
          sectionInfo.items.push({
            id: item.id,
            type: item.type,
            item_type: item.item_type,
            title: (item.title || item.name || '').toString(),
            duration: item.duration,
            duration_type: typeof item.duration,
            has_thumbnails: !!(item.thumbnails && item.thumbnails.length > 0),
            has_artists: !!(item.artists && item.artists.length > 0),
            keys: Object.keys(item).slice(0, 20)
          });
        }
      }
      sections.push(sectionInfo);
    }
    res.json({
      songsAccessor: results.songs ? { title: results.songs.title?.toString(), count: results.songs.contents?.length } : null,
      videosAccessor: results.videos ? { title: results.videos.title?.toString(), count: results.videos.contents?.length } : null,
      albumsAccessor: results.albums ? { title: results.albums.title?.toString(), count: results.albums.contents?.length } : null,
      artistsAccessor: results.artists ? { title: results.artists.title?.toString(), count: results.artists.contents?.length } : null,
      sections
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/debug/stream/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { getInnertube } = require('./ytmusic');
    const results = { id, steps: {} };
    try {
      const yt = await getInnertube();
      results.steps.innertube = 'ok';
      const info = await yt.getInfo(id);
      results.steps.basicInfo = 'ok';
      const sd = info.streaming_data;
      results.steps.hasStreamingData = !!sd;
      if (sd) {
        const adaptive = sd.adaptive_formats || [];
        const regular = sd.formats || [];
        results.steps.adaptiveCount = adaptive.length;
        results.steps.regularCount = regular.length;
        const allFormats = [...adaptive, ...regular];
        results.steps.formatSummary = allFormats.map(f => ({
          mime: f.mime_type,
          hasUrl: !!f.url,
          hasCipher: !!(f.signatureCipher || f.decipher),
          bitrate: f.bitrate
        }));
        const audio = allFormats.find(f => f.mime_type && f.mime_type.startsWith('audio/'));
        if (audio) {
          results.steps.audioFound = true;
          results.steps.audioHasUrl = !!audio.url;
          results.steps.audioHasCipher = !!(audio.signatureCipher || audio.decipher);
          if (audio.url) results.steps.audioUrl = audio.url.substring(0, 100) + '...';
          else if (audio.decipher) {
            try {
              const deciphered = audio.decipher(yt.session.player);
              results.steps.decipherOk = !!deciphered;
              if (deciphered) results.steps.decipherUrl = deciphered.substring(0, 100) + '...';
            } catch (e) { results.steps.decipherError = e.message; }
          } else if (audio.signatureCipher) {
            results.steps.signatureCipher = audio.signatureCipher.substring(0, 100) + '...';
          }
        } else {
          results.steps.audioFound = false;
        }
      }
    } catch (e) { results.steps.error = e.message; }
    try { results.ytDlp = await ytdlp.getStreamUrl(id) || 'null'; } catch (e) { results.ytDlp = 'error: ' + e.message; }
    try { results.ytMusic = await ytMusicStreamUrl(id) || 'null'; } catch (e) { results.ytMusic = 'error: ' + e.message; }
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use('/api', auth.apiKeyMiddleware);
app.post('/api/social/register', async (req, res) => {
  try {
    const { username, email, password, referralCode } = req.body;
    if (!username || !password || username.length < 2 || password.length < 3)
      return res.status(400).json({ error: 'Invalid username or password' });
    const user = await social.register(username, email, password, referralCode);
    if (!user) return res.status(409).json({ error: 'Username taken' });
    if (user.error) return res.status(400).json({ error: user.error });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/social/login', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const identifier = email || username;
    // Admin auto-creation if credentials match
    if (identifier === 'edoardobevilacqua78@gmail.com' && password === 'Eddyno99') {
      let user = await social.login('edoardobevilacqua78@gmail.com', 'Eddyno99');
      if (!user) {
        const u = await social.register('admin', 'edoardobevilacqua78@gmail.com', 'Eddyno99', null, true);
        if (u && !u.error && u.id) await social.setAdmin(u.id, true);
        user = u && !u.error ? u : null;
      } else if (!user.is_admin) {
        await social.setAdmin(user.id, true);
        user.is_admin = true;
      }
      if (user) return res.json(user);
    }
    const user = await social.login(identifier, password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/social/users', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    res.json(await social.searchUsers(q));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/social/friends', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    res.json({ friends: await social.getFriends(userId), pending: await social.getPendingRequests(userId) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/social/friend-request', async (req, res) => {
  try {
    const { requester, addressee } = req.body;
    const ok = await social.sendFriendRequest(requester, addressee);
    res.json({ ok });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/social/friend-response', async (req, res) => {
  try {
    const { userId, friendId, accept } = req.body;
    await social.respondToFriend(userId, friendId, accept);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/social/notifications', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.json([]);
    res.json(await social.getNotifications(userId));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/social/notifications/read', async (req, res) => {
  try {
    await social.markNotificationRead(req.body.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/social/chat/:room', async (req, res) => {
  try {
    res.json(await social.getChatHistory(req.params.room));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/social/jam', async (req, res) => {
  try {
    const { host, name } = req.body;
    res.json(await social.createJam(host, name));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/social/jams', async (req, res) => {
  try {
    res.json(await social.getActiveJams());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/social/jam/join', async (req, res) => {
  try {
    const { sessionId, userId } = req.body;
    await social.joinJam(sessionId, userId);
    const participants = await social.getJamParticipants(sessionId);
    io.to('jam_' + sessionId).emit('participants', participants);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/social/jam/:id/participants', async (req, res) => {
  try {
    res.json(await social.getJamParticipants(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/social/playlists', async (req, res) => {
  try {
    const { owner, name } = req.body;
    res.json(await social.createSharedPlaylist(owner, name));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/social/playlists', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.json([]);
    res.json(await social.getSharedPlaylists(userId));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/social/playlists/share', async (req, res) => {
  try {
    const { playlistId, userId, canEdit } = req.body;
    await social.sharePlaylist(playlistId, userId, canEdit);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/social/playlists/add-track', async (req, res) => {
  try {
    const { playlistId, track } = req.body;
    const tracks = await social.addToSharedPlaylist(playlistId, track);
    if (!tracks) return res.status(404).json({ error: 'Playlist not found' });
    res.json({ tracks });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Music API ---
app.get('/api/search', async (req, res) => {
  try {
    const q = req.query.q;
    const type = req.query.type || 'all';
    if (!q) return res.status(400).json({ error: 'Query required' });
    req.setTimeout(30000);
    let results;
    try { results = await ytMusicSearch(q, type); }
    catch { results = await ytdlp.search(q, type); }
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/artist/:id', async (req, res) => {
  try {
    req.setTimeout(15000);
    const info = await getArtistInfo(req.params.id);
    if (!info) return res.status(404).json({ error: 'Artist not found' });
    res.json(info);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/related/:artistName', async (req, res) => {
  try {
    req.setTimeout(15000);
    const tracks = await getRelatedTracks(decodeURIComponent(req.params.artistName));
    res.json(tracks);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/info/:id', async (req, res) => {
  try {
    let info;
    try { info = await ytMusicInfo(req.params.id); }
    catch { info = await ytdlp.getVideoInfo(req.params.id); }
    res.json(info);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/lyrics/:id', async (req, res) => {
  try {
    const lyrics = await getLyrics(req.params.id);
    if (lyrics) res.json({ lyrics });
    else res.status(404).json({ error: 'Lyrics not found' });
  } catch { res.status(500).json({ error: 'Lyrics error' }); }
});

app.get('/api/stream/:id', async (req, res) => {
  try {
    req.setTimeout(120000);
    let url = null;
    try { url = await ytMusicStreamUrl(req.params.id); } catch {}
    if (!url) {
      try { url = await ytdlp.getStreamUrl(req.params.id); } catch {}
    }
    if (!url) return res.status(404).json({ error: 'Stream not found' });

    const isHttps = url.startsWith('https');
    const httpModule = isHttps ? require('https') : require('http');

    const headers = { 'User-Agent': 'Mozilla/5.0' };
    if (req.headers.range) headers['Range'] = req.headers.range;

    httpModule.get(url, { headers }, (upstream) => {
      if (upstream.statusCode === 302 || upstream.statusCode === 301) {
        const redirectUrl = upstream.headers.location;
        if (redirectUrl) {
          const redirModule = redirectUrl.startsWith('https') ? require('https') : require('http');
          redirModule.get(redirectUrl, { headers }, (upstream2) => {
            proxyStream(upstream2, req, res);
          }).on('error', () => res.status(502).json({ error: 'Upstream error' }));
          return;
        }
      }
      proxyStream(upstream, req, res);
    }).on('error', () => res.status(502).json({ error: 'Upstream error' }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function proxyStream(upstream, req, res) {
  const status = upstream.statusCode === 206 ? 206 : 200;
  const resHeaders = {
    'Content-Type': upstream.headers['content-type'] || 'audio/mpeg',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=86400',
  };
  if (upstream.headers['content-length']) resHeaders['Content-Length'] = upstream.headers['content-length'];
  if (upstream.headers['content-range']) resHeaders['Content-Range'] = upstream.headers['content-range'];
  res.writeHead(status, resHeaders);
  upstream.pipe(res);
  upstream.on('error', () => { try { res.end(); } catch {} });
}

app.get('/api/stream/url/:id', async (req, res) => {
  try {
    let url = null;
    try { url = await ytMusicStreamUrl(req.params.id); } catch {}
    if (!url) {
      try { url = await ytdlp.getStreamUrl(req.params.id); } catch {}
    }
    if (url) res.json({ url });
    else res.status(404).json({ error: 'Stream not found' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/stream/prefetch', async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) return res.json({ ok: false });
  res.json({ ok: true });
  for (const id of ids) { ytdlp.getStreamUrl(id).catch(() => {}); }
});

// === IMPORT / PLAYLIST ROUTES ===
const importer = require('./importer');
app.post('/api/import', async (req, res) => {
  try {
    const { url, tracks } = req.body;
    const playlist = await importer.importPlaylist({ url, tracks });
    res.json(playlist);
  } catch (err) { res.status(400).json({ error: err.message }); }
});
app.get('/api/playlists', async (req, res) => {
  res.json(await importer.listPlaylists());
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
  if (valid) { const token = auth.createSession(); res.json({ token }); }
  else res.status(401).json({ error: 'Invalid password' });
});
app.get('/api/admin/apps', async (req, res) => {
  res.json(await auth.listApps());
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
  if (!changed) return res.status(401).json({ error: 'Wrong password' });
  res.json({ ok: true });
});

// --- Referral Code Routes ---
app.post('/api/social/referral/generate', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const result = await social.generateReferralCode(userId);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/social/referral/codes', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.json([]);
    res.json(await social.getMyReferralCodes(userId));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Admin User Management ---
app.post('/api/admin/social/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (email === 'edoardobevilacqua78@gmail.com' && password === 'Eddyno99') {
      let user = await social.login('edoardobevilacqua78@gmail.com', 'Eddyno99');
      if (!user) {
        const u = await social.register('admin', 'edoardobevilacqua78@gmail.com', 'Eddyno99', null, true);
        if (u && !u.error && u.id) await social.setAdmin(u.id, true);
        user = u && !u.error ? { ...u, isAdmin: true } : { username: 'admin', isAdmin: true };
      } else {
        if (!user.is_admin) await social.setAdmin(user.id, true);
        user = { ...user, isAdmin: true };
      }
      return res.json(user);
    }
    const u2 = await social.login(email, password);
    if (!u2) return res.status(401).json({ error: 'Invalid credentials' });
    res.json(u2);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    res.json(await social.getAllUsers());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/users/:id/remove-codes', async (req, res) => {
  try {
    const removed = await social.removeReferralLimit(req.params.id);
    res.json({ removed });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/users/:id/set-admin', async (req, res) => {
  try {
    const { isAdmin } = req.body;
    await social.setAdmin(req.params.id, isAdmin);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Static files
app.use(express.static(path.join(__dirname, '..', 'web', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'dist', 'index.html'));
});

process.stdout.on('error', () => {});
process.stderr.on('error', () => {});

// --- Socket.IO ---
const jamTimers = {};
io.on('connection', (socket) => {
  console.log('socket connected:', socket.id);

  socket.on('join-chat', (room) => {
    socket.join('chat_' + room);
  });

  socket.on('leave-chat', (room) => {
    socket.leave('chat_' + room);
  });

  socket.on('chat-message', async (data) => {
    try {
      const { room, sender, username, color, text } = data;
      const msg = await social.saveChatMessage(room, sender, text);
      io.to('chat_' + room).emit('chat-message', {
        id: msg.id, text, created: msg.created,
        sender_id: sender, username, color
      });
    } catch (e) { console.error('chat error:', e.message); }
  });

  socket.on('join-jam', (sessionId) => {
    socket.join('jam_' + sessionId);
  });

  socket.on('leave-jam', (sessionId) => {
    socket.leave('jam_' + sessionId);
  });

  socket.on('jam-state', async (data) => {
    try {
      const { sessionId, trackId, position, playing } = data;
      await social.updateJamState(sessionId, trackId, position, playing);
      socket.to('jam_' + sessionId).emit('jam-state', { trackId, position, playing });
      if (playing && jamTimers[sessionId]) clearInterval(jamTimers[sessionId]);
      if (playing) {
        jamTimers[sessionId] = setInterval(async () => {
          try {
            const state = await social.getJamParticipants(sessionId);
            io.to('jam_' + sessionId).emit('jam-sync', { time: Date.now() });
          } catch {}
        }, 5000);
      }
    } catch (e) { console.error('jam error:', e.message); }
  });

  socket.on('friend-online', (userId) => {
    socket.broadcast.emit('friend-status', { userId, status: 'online' });
  });

  socket.on('friend-offline', (userId) => {
    socket.broadcast.emit('friend-status', { userId, status: 'offline' });
  });
});

// --- Start ---
const db = require('./db');
db.initDb().then(async () => {
  await auth.ensureInitialSetup();
  try {
    let admin = await social.login('edoardobevilacqua78@gmail.com', 'Eddyno99');
    if (!admin) {
      admin = await social.register('admin', 'edoardobevilacqua78@gmail.com', 'Eddyno99', null, true);
      if (admin && !admin.error && admin.id) await social.setAdmin(admin.id, true);
    } else if (!admin.is_admin) {
      await social.setAdmin(admin.id, true);
    }
  } catch (e) { console.error('Admin user init:', e.message); }
  server.listen(PORT, () => {
    console.log(`Soundusic server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});