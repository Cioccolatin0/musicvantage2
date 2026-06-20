const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CACHE_DIR = path.join(__dirname, 'cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

const memCache = {};
const CACHE_TTL = 6 * 60 * 60 * 1000;
const MEM_TTL = 5 * 60 * 1000;

const pending = {};

function getYtDlpPath() {
  const candidates = [
    path.join(process.env.APPDATA || '', 'Python', 'Python313', 'Scripts', 'yt-dlp.exe'),
    'yt-dlp', 'yt-dlp.exe'
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  return 'yt-dlp';
}

const YTDLP = getYtDlpPath();

function resolveProxy() {
  const single = process.env.YT_PROXY;
  if (single) return single;
  const list = process.env.YT_PROXY_LIST;
  if (list) {
    const proxies = list.split(',').map(s => s.trim()).filter(Boolean);
    if (proxies.length) return proxies[Math.floor(Math.random() * proxies.length)];
  }
  return null;
}

const BASE_ARGS = [
  '--no-warnings', '--no-check-certificates',
  '--socket-timeout', '15',
  '--extractor-retries', '1'
];

const cookiesFile = process.env.YT_COOKIES_FILE;
if (cookiesFile && fs.existsSync(cookiesFile)) {
  BASE_ARGS.push('--cookies', cookiesFile);
}

if (process.env.YT_PROXY) {
  BASE_ARGS.push('--proxy', process.env.YT_PROXY);
}

function runYtDlp(args, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const extraArgs = [];
    if (!process.env.YT_PROXY) {
      const p = resolveProxy();
      if (p) extraArgs.push('--proxy', p);
    }
    const allArgs = [...BASE_ARGS, ...extraArgs, ...args];
    const child = spawn(YTDLP, allArgs, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    let done = false;

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        if (child.pid) {
          spawn('taskkill', ['/f', '/t', '/pid', String(child.pid)], { windowsHide: true });
        }
        reject(new Error('Timed out'));
      }
    }, timeout);

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `Exit code ${code}`));
    });

    child.on('error', (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function dedupedRun(key, runner) {
  if (pending[key]) return pending[key];
  const p = runner().finally(() => { delete pending[key]; });
  pending[key] = p;
  return p;
}

function cacheSet(key, payload) {
  memCache[key] = { ts: Date.now(), data: payload };
  try {
    const file = path.join(CACHE_DIR, key.replace(/[^a-zA-Z0-9]/g, '_') + '.json');
    fs.writeFileSync(file, JSON.stringify({ ts: Date.now(), payload }));
  } catch {}
}

function cacheGet(key) {
  const now = Date.now();
  if (memCache[key] && now - memCache[key].ts < MEM_TTL) return memCache[key].data;
  const file = path.join(CACHE_DIR, key.replace(/[^a-zA-Z0-9]/g, '_') + '.json');
  if (fs.existsSync(file)) {
    try {
      const d = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (now - d.ts < CACHE_TTL) {
        memCache[key] = { ts: now, data: d.payload };
        return d.payload;
      }
    } catch {}
  }
  return null;
}

async function search(query, type = 'all') {
  const cacheKey = `s_${query}_${type}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  return dedupedRun(cacheKey, async () => {
    const [trackRaw, albumRaw] = await Promise.all([
      runYtDlp(['--dump-json', '--flat-playlist', '--no-playlist', `ytsearch6:${query}`], 30000).catch(() => ''),
      type === 'all'
        ? runYtDlp(['--dump-json', '--flat-playlist', '--no-playlist', `ytsearch4:${query} album`], 30000).catch(() => '')
        : Promise.resolve('')
    ]);

    const tracks = trackRaw.split('\n').filter(Boolean).map(line => {
      try {
        const i = JSON.parse(line);
        return {
          id: i.id, title: i.title || 'Unknown',
          artist: i.uploader || i.channel || 'Unknown',
          thumbnail: `https://i.ytimg.com/vi/${i.id}/hqdefault.jpg`,
          duration: i.duration || 0,
          url: `https://youtube.com/watch?v=${i.id}`,
          type: 'track'
        };
      } catch { return null; }
    }).filter(Boolean);

    const artists = [];
    const seenArtists = new Set();
    for (const t of tracks) {
      if (t.artist && !seenArtists.has(t.artist)) {
        seenArtists.add(t.artist);
        artists.push({ id: t.id, title: t.artist, thumbnail: t.thumbnail, trackCount: 0, type: 'artist' });
      }
    }

    const seen = new Set();
    const albums = albumRaw.split('\n').filter(Boolean).map(line => {
      try {
        const i = JSON.parse(line);
        const name = i.title?.replace(/\(.*?\)|\[.*?\]/g, '').trim();
        if (!name || seen.has(name)) return null;
        seen.add(name);
        return {
          id: i.id, title: name, artist: i.uploader || 'Unknown',
          thumbnail: `https://i.ytimg.com/vi/${i.id}/hqdefault.jpg`,
          trackCount: i.playlist_count || 0, type: 'album'
        };
      } catch { return null; }
    }).filter(Boolean);

    const result = { tracks: tracks.slice(0, 6), albums: albums.slice(0, 4), artists: artists.slice(0, 4) };
    cacheSet(cacheKey, result);
    for (const t of result.tracks) {
      getStreamUrl(t.id).catch(() => {});
    }
    return result;
  });
}

async function getStreamUrl(videoId) {
  const cacheKey = `u_${videoId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  return dedupedRun(cacheKey, async () => {
    const raw = await runYtDlp([
      '-f', 'bestaudio[ext=m4a]/bestaudio/best',
      '--get-url', '--no-playlist',
      `https://www.youtube.com/watch?v=${videoId}`
    ], 60000);
    const url = raw.split('\n')[0];
    if (url && url.startsWith('http')) {
      cacheSet(cacheKey, url);
      return url;
    }
    return null;
  }).catch(() => null);
}

async function getVideoInfo(videoId) {
  const cacheKey = `i_${videoId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  return dedupedRun(cacheKey, async () => {
    const raw = await runYtDlp([
      '--dump-json', '--flat-playlist', '--no-playlist',
      `https://www.youtube.com/watch?v=${videoId}`
    ], 60000);
    const info = JSON.parse(raw.split('\n')[0]);
    const result = {
      id: info.id, title: info.title || 'Unknown',
      artist: info.uploader || info.channel || 'Unknown',
      thumbnail: info.thumbnail || `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg`,
      duration: info.duration || 0, description: info.description || '',
      webpage_url: info.webpage_url
    };
    cacheSet(cacheKey, result);
    return result;
  }).catch(() => ({
    id: videoId, title: 'Unknown', artist: 'Unknown',
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: 0, description: '',
    webpage_url: `https://youtube.com/watch?v=${videoId}`
  }));
}

function warmup() {
  runYtDlp(['--version'], 10000).then(v => {
    console.log(`yt-dlp warmed up (v${v})`);
    runYtDlp(['--dump-json', '--flat-playlist', '--no-playlist', 'ytsearch1:warmup'], 60000)
      .then(() => console.log('yt-dlp extractors pre-warmed'))
      .catch(() => {});
  }).catch(() => {});
}

warmup();

module.exports = { search, getStreamUrl, getVideoInfo, runYtDlp, cacheSet, cacheGet, dedupedRun };
