require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { search: ytMusicSearch, getVideoInfo: ytMusicInfo, getLyrics, getArtistInfo, getRelatedTracks } = require('./ytmusic');
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
    catch (err) { return res.status(500).json({ error: err.message }); }
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
    const info = await ytMusicInfo(req.params.id);
    if (!info) return res.status(404).json({ error: 'Not found' });
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

// Stream routes removed — YouTube IFrame handles playback client-side

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