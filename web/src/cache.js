const CACHE_PREFIX = 'sv_cache_';
const CACHE_TTL = 5 * 60 * 1000; // 5 min
const MAX_CACHE_SIZE = 20;

export function getCachedSearch(query) {
  try {
    const key = CACHE_PREFIX + query.toLowerCase().trim();
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

export function setCachedSearch(query, data) {
  try {
    const key = CACHE_PREFIX + query.toLowerCase().trim();
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
    cleanOldCache();
  } catch {}
}

function cleanOldCache() {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    if (keys.length > MAX_CACHE_SIZE) {
      const entries = keys.map(k => ({ k, ts: JSON.parse(localStorage.getItem(k) || '{}').ts || 0 }));
      entries.sort((a, b) => a.ts - b.ts);
      entries.slice(0, keys.length - MAX_CACHE_SIZE).forEach(e => localStorage.removeItem(e.k));
    }
  } catch {}
}

export function getRecentTracks() {
  try { return JSON.parse(localStorage.getItem('sv_recent') || '[]'); } catch { return []; }
}

export function addRecentTrack(track) {
  try {
    const recent = getRecentTracks().filter(t => t.id !== track.id);
    recent.unshift({ id: track.id, title: track.title, artist: track.artist, thumbnail: track.thumbnail, duration: track.duration });
    localStorage.setItem('sv_recent', JSON.stringify(recent.slice(0, 50)));
  } catch {}
}

export function getDownloads() {
  try { return JSON.parse(localStorage.getItem('sv_downloads') || '[]'); } catch { return []; }
}

export function addDownload(track) {
  try {
    const dl = getDownloads();
    if (!dl.find(t => t.id === track.id)) {
      dl.unshift({ id: track.id, title: track.title, artist: track.artist, thumbnail: track.thumbnail, duration: track.duration, downloadedAt: Date.now() });
      localStorage.setItem('sv_downloads', JSON.stringify(dl));
    }
  } catch {}
}

export function removeDownload(trackId) {
  try {
    const dl = getDownloads().filter(t => t.id !== trackId);
    localStorage.setItem('sv_downloads', JSON.stringify(dl));
  } catch {}
}

export function isDownloaded(trackId) {
  return getDownloads().some(t => t.id === trackId);
}
