const crypto = require('crypto');
const db = require('./db');

function hashPassword(pw) { return crypto.createHash('sha256').update(pw).digest('hex'); }

async function register(username, password) {
  const existing = await db.query('SELECT id FROM social_users WHERE username = $1', [username]);
  if (existing.rows.length > 0) return null;
  const color = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  const { rows } = await db.query(
    'INSERT INTO social_users (username, password, color, created) VALUES ($1, $2, $3, $4) RETURNING id, username, color',
    [username, hashPassword(password), color, Date.now()]
  );
  return rows[0];
}

async function login(username, password) {
  const { rows } = await db.query('SELECT id, username, color FROM social_users WHERE username = $1 AND password = $2', [username, hashPassword(password)]);
  return rows[0] || null;
}

async function getUser(id) {
  const { rows } = await db.query('SELECT id, username, color, created FROM social_users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function searchUsers(q) {
  const { rows } = await db.query('SELECT id, username, color FROM social_users WHERE username ILIKE $1 LIMIT 20', [`%${q}%`]);
  return rows;
}

async function sendFriendRequest(requester, addressee) {
  if (requester === addressee) return null;
  const { rows } = await db.query(
    'INSERT INTO friendships (requester, addressee, status, created) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id',
    [requester, addressee, 'pending', Date.now()]
  );
  if (rows.length > 0) {
    await db.query('INSERT INTO notifications (user_id, type, payload, created) VALUES ($1, $2, $3, $4)',
      [addressee, 'friend_request', JSON.stringify({ from: requester }), Date.now()]);
  }
  return rows.length > 0;
}

async function respondToFriend(userId, friendId, accept) {
  const { rows } = await db.query(
    'SELECT id, requester FROM friendships WHERE (requester = $1 AND addressee = $2) OR (requester = $2 AND addressee = $1)',
    [userId, friendId]
  );
  if (rows.length === 0) return false;
  if (accept) {
    await db.query('UPDATE friendships SET status = $1 WHERE id = $2', ['accepted', rows[0].id]);
    const otherId = rows[0].requester === userId ? rows[0].requester : rows[0].requester;
    return true;
  } else {
    await db.query('DELETE FROM friendships WHERE id = $1', [rows[0].id]);
    return true;
  }
}

async function getFriends(userId) {
  const { rows } = await db.query(`
    SELECT su.id, su.username, su.color, f.status
    FROM friendships f JOIN social_users su ON
      (CASE WHEN f.requester = $1 THEN f.addressee ELSE f.requester END) = su.id
    WHERE (f.requester = $1 OR f.addressee = $1) AND f.status = 'accepted'
  `, [userId]);
  return rows;
}

async function getPendingRequests(userId) {
  const { rows } = await db.query(`
    SELECT su.id, su.username, su.color, f.id as f_id
    FROM friendships f JOIN social_users su ON f.requester = su.id
    WHERE f.addressee = $1 AND f.status = 'pending'
  `, [userId]);
  return rows;
}

async function getNotifications(userId) {
  const { rows } = await db.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created DESC LIMIT 50', [userId]);
  return rows;
}

async function markNotificationRead(nid) {
  await db.query('UPDATE notifications SET read = TRUE WHERE id = $1', [nid]);
}

async function saveChatMessage(room, sender, text) {
  const { rows } = await db.query(
    'INSERT INTO chat_messages (room, sender, text, created) VALUES ($1, $2, $3, $4) RETURNING id, created',
    [room, sender, text, Date.now()]
  );
  return rows[0];
}

async function getChatHistory(room, limit = 50) {
  const { rows } = await db.query(
    `SELECT cm.id, cm.text, cm.created, su.id as sender_id, su.username, su.color
     FROM chat_messages cm JOIN social_users su ON cm.sender = su.id
     WHERE cm.room = $1 ORDER BY cm.created DESC LIMIT $2`,
    [room, limit]
  );
  return rows.reverse();
}

async function createJam(host, name) {
  const { rows } = await db.query(
    'INSERT INTO jam_sessions (host, name, created) VALUES ($1, $2, $3) RETURNING *',
    [host, name, Date.now()]
  );
  return rows[0];
}

async function joinJam(sessionId, userId) {
  await db.query(
    'INSERT INTO jam_participants (session, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [sessionId, userId]
  );
}

async function leaveJam(sessionId, userId) {
  await db.query('DELETE FROM jam_participants WHERE session = $1 AND user_id = $2', [sessionId, userId]);
}

async function getJamParticipants(sessionId) {
  const { rows } = await db.query(`
    SELECT su.id, su.username, su.color
    FROM jam_participants jp JOIN social_users su ON jp.user_id = su.id
    WHERE jp.session = $1
  `, [sessionId]);
  return rows;
}

async function getActiveJams() {
  const { rows } = await db.query(`
    SELECT js.*, su.username as host_username, su.color as host_color
    FROM jam_sessions js JOIN social_users su ON js.host = su.id
    WHERE js.active = TRUE ORDER BY js.created DESC LIMIT 20
  `);
  return rows;
}

async function updateJamState(sessionId, trackId, position, playing) {
  await db.query(
    'UPDATE jam_sessions SET track_id = $2, position = $3, playing = $4 WHERE id = $1',
    [sessionId, trackId, position, playing]
  );
}

async function createSharedPlaylist(owner, name) {
  const { rows } = await db.query(
    'INSERT INTO shared_playlists (owner, name, created) VALUES ($1, $2, $3) RETURNING *',
    [owner, name, Date.now()]
  );
  return rows[0];
}

async function getSharedPlaylists(userId) {
  const { rows } = await db.query(`
    SELECT sp.*, su.username as owner_username
    FROM shared_playlists sp JOIN social_users su ON sp.owner = su.id
    WHERE sp.owner = $1 OR sp.id IN (SELECT playlist FROM playlist_shares WHERE user_id = $1)
    ORDER BY sp.created DESC
  `, [userId]);
  return rows;
}

async function sharePlaylist(playlistId, userId, canEdit) {
  await db.query(
    'INSERT INTO playlist_shares (playlist, user_id, can_edit) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [playlistId, userId, canEdit]
  );
  const pl = await db.query('SELECT name FROM shared_playlists WHERE id = $1', [playlistId]);
  if (pl.rows[0]) {
    await db.query('INSERT INTO notifications (user_id, type, payload, created) VALUES ($1, $2, $3, $4)',
      [userId, 'playlist_share', JSON.stringify({ playlistId, name: pl.rows[0].name }), Date.now()]);
  }
}

async function addToSharedPlaylist(playlistId, track) {
  const pl = await db.query('SELECT tracks FROM shared_playlists WHERE id = $1', [playlistId]);
  if (pl.rows.length === 0) return null;
  const tracks = [...pl.rows[0].tracks, track];
  await db.query('UPDATE shared_playlists SET tracks = $1 WHERE id = $2', [JSON.stringify(tracks), playlistId]);
  const shares = await db.query('SELECT user_id FROM playlist_shares WHERE playlist = $1', [playlistId]);
  for (const s of shares.rows) {
    await db.query('INSERT INTO notifications (user_id, type, payload, created) VALUES ($1, $2, $3, $4)',
      [s.user_id, 'playlist_update', JSON.stringify({ playlistId, track: track.title }), Date.now()]);
  }
  return tracks;
}

module.exports = {
  register, login, getUser, searchUsers,
  sendFriendRequest, respondToFriend, getFriends, getPendingRequests,
  getNotifications, markNotificationRead,
  saveChatMessage, getChatHistory,
  createJam, joinJam, leaveJam, getJamParticipants, getActiveJams, updateJamState,
  createSharedPlaylist, getSharedPlaylists, sharePlaylist, addToSharedPlaylist
};