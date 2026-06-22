const fs = require('fs');

let innertube = null;
let initPromise = null;

async function init() {
  const { Innertube } = await import('youtubei.js');
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

function thumbUrl(item) {
  if (item.thumbnails && item.thumbnails.length > 0) {
    const thumbs = item.thumbnails;
    return thumbs[thumbs.length - 1].url || thumbs[0].url;
  }
  if (item.id && item.id.length === 11 && /^[a-zA-Z0-9_-]+$/.test(item.id)) {
    return `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;
  }
  return `https://i.ytimg.com/vi/${item.id || 'default'}/hqdefault.jpg`;
}

function parseDuration(dur) {
  if (typeof dur === 'number') return dur;
  if (dur && typeof dur === 'object') {
    if (dur.seconds) return parseInt(dur.seconds) || 0;
    if (dur.text) return parseDuration(dur.text);
    if (dur.length_seconds) return parseInt(dur.length_seconds) || 0;
  }
  if (typeof dur === 'string' && dur.includes(':')) {
    const parts = dur.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

function getArtist(item) {
  if (item.artists && item.artists.length > 0) return item.artists[0].name;
  if (item.authors && item.authors.length > 0) return item.authors[0].name;
  return 'Unknown';
}

async function search(query, type = 'all') {
  const yt = await getInnertube();
  const results = await yt.music.search(query);

  const tracks = [];
  const albums = [];
  const artists = [];

  for (const section of results.contents) {
    try {
      if (!section.contents) continue;
      for (const item of section.contents) {
        if (item.type !== 'MusicResponsiveListItem' || !item.id) continue;
        if (item.item_type === 'song') {
          tracks.push({
            id: item.id,
            title: item.title || 'Unknown',
            artist: getArtist(item),
            thumbnail: thumbUrl(item),
            duration: parseDuration(item.duration),
            url: `https://youtube.com/watch?v=${item.id}`,
            type: 'track'
          });
        } else if (item.item_type === 'album') {
          albums.push({
            id: item.id,
            title: item.title || 'Unknown',
            artist: getArtist(item),
            thumbnail: thumbUrl(item),
            trackCount: item.song_count || item.track_count || 0,
            type: 'album'
          });
        } else if (item.item_type === 'artist') {
          artists.push({
            id: item.id,
            title: item.name || item.title || 'Unknown',
            thumbnail: thumbUrl(item),
            trackCount: 0,
            type: 'artist'
          });
        }
      }
    } catch {}
  }

  return { tracks, albums: albums.slice(0, 4), artists: artists.slice(0, 4) };
}

async function getVideoInfo(videoId) {
  const yt = await getInnertube();
  try {
    const info = await yt.getBasicInfo(videoId);
    const b = info.basic_info || {};
    return {
      id: videoId,
      title: b.title || info.title || 'Unknown',
      artist: b.channel?.[0]?.name || info.author?.name || (info.primary_info?.title?.runs?.[0]?.text) || 'Unknown',
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: parseDuration(b.duration || info.duration),
      description: b.description || info.description || '',
      webpage_url: `https://youtube.com/watch?v=${videoId}`
    };
  } catch {
    return {
      id: videoId, title: 'Unknown', artist: 'Unknown',
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: 0, description: '', webpage_url: `https://youtube.com/watch?v=${videoId}`
    };
  }
}

async function getLyrics(videoId) {
  try {
    const yt = await getInnertube();
    const info = await yt.getBasicInfo(videoId);
    if (info?.getLyrics) {
      const lyrics = await info.getLyrics();
      if (lyrics) return lyrics.content?.toString() || lyrics.toString();
    }
  } catch {}
  return null;
}

module.exports = { search, getVideoInfo, getLyrics, getInnertube };
