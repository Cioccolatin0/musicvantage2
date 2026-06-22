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
    removeAudioBlob(trackId);
  } catch {}
}

export function isDownloaded(trackId) {
  return getDownloads().some(t => t.id === trackId);
}

// --- IndexedDB Audio Storage ---
const DB_NAME = 'soundusic_audio';
const DB_VERSION = 1;
const STORE_NAME = 'audio_blobs';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAudioBlob(trackId, blob) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, trackId);
  } catch {}
}

export async function getAudioBlob(trackId) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(trackId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function removeAudioBlob(trackId) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(trackId);
  } catch {}
}

export async function downloadTrackAudio(trackId, apiUrl) {
  try {
    const existing = await getAudioBlob(trackId);
    if (existing) return true;
    const res = await fetch(apiUrl);
    if (!res.ok) return false;
    const blob = await res.blob();
    await saveAudioBlob(trackId, blob);
    return true;
  } catch { return false; }
}

export async function getAudioUrl(trackId) {
  const blob = await getAudioBlob(trackId);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
