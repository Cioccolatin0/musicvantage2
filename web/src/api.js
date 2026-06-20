const API = '/api';

let apiKey = null;
let configPromise = null;

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

async function authFetch(url, options = {}) {
  await configPromise;
  const headers = { ...options.headers };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  return fetch(url, { ...options, headers });
}

export async function search(query, type = 'all') {
  const res = await authFetch(`${API}/search?q=${encodeURIComponent(query)}&type=${type}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function getInfo(id) {
  const res = await authFetch(`${API}/info/${id}`);
  if (!res.ok) throw new Error('Failed to get info');
  return res.json();
}

export async function getStreamUrl(id) {
  const res = await authFetch(`${API}/stream/url/${id}`);
  if (!res.ok) throw new Error('Stream not found');
  const data = await res.json();
  return data.url;
}

export function getStreamUrlDirect(id) {
  return addKey(`${API}/stream/${id}`);
}

export async function prefetchStreamUrls(ids) {
  await authFetch(`${API}/stream/prefetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  }).catch(() => {});
}

export async function getLyrics(id) {
  const res = await authFetch(`${API}/lyrics/${id}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.lyrics;
}

// === Admin API ===
let adminToken = null;

export function setAdminToken(token) {
  adminToken = token;
}

export function getAdminToken() {
  return adminToken;
}

async function adminFetch(url, options = {}) {
  const headers = { ...options.headers };
  if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
  return fetch(url, { ...options, headers });
}

export async function adminLogin(password) {
  const res = await fetch(`${API}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  if (!res.ok) throw new Error('Invalid password');
  const data = await res.json();
  adminToken = data.token;
  return data.token;
}

export async function adminListApps() {
  const res = await adminFetch(`${API}/admin/apps`);
  return res.json();
}

export async function adminCreateApp(name) {
  const res = await adminFetch(`${API}/admin/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  if (!res.ok) throw new Error('Failed to create app');
  return res.json();
}

export async function adminRevokeApp(name) {
  const res = await adminFetch(`${API}/admin/apps/${encodeURIComponent(name)}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to revoke app');
  return res.json();
}

export async function adminChangePassword(oldPwd, newPwd) {
  const res = await adminFetch(`${API}/admin/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd })
  });
  if (!res.ok) throw new Error('Wrong password');
  return res.json();
}

export { authFetch };
