const API = '/api';
let apiKey = null;
let configPromise = null;
let socket = null;

async function fetchConfig() {
  try {
    const res = await fetch(`${API}/config`);
    const data = await res.json();
    apiKey = data.key;
  } catch { apiKey = ''; }
}
configPromise = fetchConfig();

function addKey(url) {
  if (!apiKey) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}key=${encodeURIComponent(apiKey)}`;
}

export async function authFetch(url, options = {}) {
  await configPromise;
  const headers = { ...options.headers };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  return fetch(url, { ...options, headers });
}

// --- Music API ---
export async function search(query, type = 'all') {
  const res = await authFetch(`${API}/search?q=${encodeURIComponent(query)}&type=${type}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}
export async function getStreamUrl(id) {
  const res = await authFetch(`${API}/stream/url/${id}`);
  if (!res.ok) return null;
  const d = await res.json();
  return d.url || null;
}
export async function getInfo(id) {
  const res = await authFetch(`${API}/info/${id}`);
  if (!res.ok) throw new Error('Failed to get info');
  return res.json();
}
export async function getLyrics(id) {
  const res = await authFetch(`${API}/lyrics/${id}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.lyrics;
}

export async function getArtistInfo(artistId) {
  const res = await authFetch(`${API}/artist/${artistId}`);
  if (!res.ok) return null;
  return res.json();
}

export async function getRelatedTracks(artistName) {
  const res = await authFetch(`${API}/related/${encodeURIComponent(artistName)}`);
  if (!res.ok) return [];
  return res.json();
}

// --- Social Auth ---
export async function socialRegister(username, email, password, referralCode) {
  const res = await authFetch(`${API}/social/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password, referralCode })
  });
  return res.json();
}
export async function socialLogin(identifier, password) {
  const res = await authFetch(`${API}/social/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: identifier, password })
  });
  return res.json();
}
export async function searchUsers(q) {
  const res = await authFetch(`${API}/social/users?q=${encodeURIComponent(q)}`);
  return res.json();
}
export async function getFriends(userId) {
  const res = await authFetch(`${API}/social/friends?userId=${userId}`);
  return res.json();
}
export async function sendFriendRequest(requester, addressee) {
  const res = await authFetch(`${API}/social/friend-request`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requester, addressee })
  });
  return res.json();
}
export async function respondToFriend(userId, friendId, accept) {
  const res = await authFetch(`${API}/social/friend-response`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, friendId, accept })
  });
  return res.json();
}
export async function getNotifications(userId) {
  const res = await authFetch(`${API}/social/notifications?userId=${userId}`);
  return res.json();
}
export async function markNotificationRead(id) {
  await authFetch(`${API}/social/notifications/read`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
}
export async function getChatHistory(room) {
  const res = await authFetch(`${API}/social/chat/${room}`);
  return res.json();
}
export async function createJam(host, name) {
  const res = await authFetch(`${API}/social/jam`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, name })
  });
  return res.json();
}
export async function getActiveJams() {
  const res = await authFetch(`${API}/social/jams`);
  return res.json();
}
export async function joinJam(sessionId, userId) {
  await authFetch(`${API}/social/jam/join`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, userId })
  });
}
export async function getJamParticipants(sessionId) {
  const res = await authFetch(`${API}/social/jam/${sessionId}/participants`);
  return res.json();
}
export async function createSharedPlaylist(owner, name) {
  const res = await authFetch(`${API}/social/playlists`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner, name })
  });
  return res.json();
}
export async function getSharedPlaylists(userId) {
  const res = await authFetch(`${API}/social/playlists?userId=${userId}`);
  return res.json();
}
export async function sharePlaylist(playlistId, userId, canEdit) {
  await authFetch(`${API}/social/playlists/share`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playlistId, userId, canEdit })
  });
}
export async function addTrackToSharedPlaylist(playlistId, track) {
  const res = await authFetch(`${API}/social/playlists/add-track`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playlistId, track })
  });
  return res.json();
}

// --- Admin ---
let adminToken = '';
export function setAdminToken(t) { adminToken = t; }
export function getAdminToken() { return adminToken; }

export async function adminLogin(password) {
  const res = await fetch(`${API}/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const d = await res.json();
  if (d.success) setAdminToken(d.token);
  return d;
}
export async function adminChangePassword(oldPw, newPw) {
  const res = await fetch(`${API}/admin/change-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: adminToken, oldPassword: oldPw, newPassword: newPw })
  });
  return res.json();
}
export async function adminListApps() {
  const res = await fetch(`${API}/admin/apps?token=${adminToken}`);
  return res.json();
}
export async function adminCreateApp(data) {
  const res = await fetch(`${API}/admin/apps`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: adminToken, ...data })
  });
  return res.json();
}
export async function adminRevokeApp(id) {
  const res = await fetch(`${API}/admin/apps/revoke`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: adminToken, appId: id })
  });
  return res.json();
}

// --- Referral Codes ---
export async function generateReferralCode(userId) {
  const res = await authFetch(`${API}/social/referral/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });
  return res.json();
}
export async function getMyReferralCodes(userId) {
  const res = await authFetch(`${API}/social/referral/codes?userId=${userId}`);
  return res.json();
}

// --- Admin Social ---
export async function adminSocialLogin(email, password) {
  const res = await authFetch(`${API}/admin/social/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return res.json();
}
export async function adminGetUsers() {
  const res = await authFetch(`${API}/admin/users`);
  return res.json();
}
export async function adminRemoveUserCodes(userId) {
  const res = await authFetch(`${API}/admin/users/${userId}/remove-codes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  });
  return res.json();
}
export async function adminSetUserAdmin(userId, isAdmin) {
  const res = await authFetch(`${API}/admin/users/${userId}/set-admin`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isAdmin })
  });
  return res.json();
}

// --- Socket.IO ---
export function getSocket() {
  if (!socket && window.io) {
    socket = io('/', { transports: ['websocket', 'polling'] });
  }
  return socket;
}