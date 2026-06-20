const { Innertube } = require('youtubei.js');
const fs = require('fs');

let innertube = null;
let initPromise = null;

async function init() {
  const opts = { lang: 'it' };
  const cookieFile = process.env.YT_COOKIES_FILE;
  if (cookieFile && fs.existsSync(cookieFile)) {
    const cookies = fs.readFileSync(cookieFile, 'utf8');
    const parsed = cookies.split('\n')
      .filter(l => l && !l.startsWith('#') && l.includes('\t'))
      .map(l => l.split('\t'))
      .filter(p => p.length >= 7)
      .map(p => `${p[5]}=${p[6]}`)
      .join('; ');
    if (parsed) opts.cookie = parsed;
  }
  innertube = await Innertube.create(opts);
}

async function getInnertube() {
  if (innertube) return innertube;
  if (!initPromise) initPromise = init();
  return initPromise;
}

async function search(query, type = 'all') {
  const yt = await getInnertube();
  const results = await yt.music.search(query);

  const tracks = (results.songs?.contents || []).map(s => ({
    id: s.id,
    title: s.title || 'Unknown',
    artist: s.authors?.[0]?.name || 'Unknown',
    thumbnail: s.thumbnails?.[0]?.url?.replace('w120-h120', 'hqdefault') || `https://i.ytimg.com/vi/${s.id}/hqdefault.jpg`,
    duration: s.duration || 0,
    url: `https://youtube.com/watch?v=${s.id}`,
    type: 'track'
  }));

  const albums = (results.albums?.contents || []).slice(0, 4).map(a => ({
    id: a.id,
    title: a.title || 'Unknown',
    artist: a.authors?.[0]?.name || 'Unknown',
    thumbnail: a.thumbnails?.[0]?.url?.replace('w120-h120', 'hqdefault') || `https://i.ytimg.com/vi/${a.id}/hqdefault.jpg`,
    trackCount: a.track_count || 0,
    type: 'album'
  }));

  const artists = (results.artists?.contents || []).slice(0, 4).map(a => ({
    id: a.id,
    title: a.name || a.title || 'Unknown',
    thumbnail: a.thumbnails?.[0]?.url?.replace('w120-h120', 'hqdefault') || '',
    trackCount: 0,
    type: 'artist'
  }));

  return { tracks, albums, artists };
}

async function getVideoInfo(videoId) {
  const yt = await getInnertube();
  const info = await yt.getBasicInfo(videoId);
  return {
    id: videoId,
    title: info.title || 'Unknown',
    artist: info.author?.name || 'Unknown',
    thumbnail: info.thumbnail?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: info.duration || 0,
    description: info.description || '',
    webpage_url: `https://youtube.com/watch?v=${videoId}`
  };
}

async function getLyrics(videoId) {
  try {
    const yt = await getInnertube();
    const info = await yt.getBasicInfo(videoId);
    const lyrics = await info.getLyrics();
    if (lyrics) return lyrics.content.toString();
  } catch {}
  return null;
}

module.exports = { search, getVideoInfo, getLyrics };
