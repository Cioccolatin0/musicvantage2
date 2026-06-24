const fs = require('fs');

let innertube = null;
let initPromise = null;

const streamCache = {};
const STREAM_CACHE_TTL = 30 * 60 * 1000;

function ytmCacheGet(key) {
  const e = streamCache[key];
  if (e && Date.now() - e.ts < STREAM_CACHE_TTL) return e.data;
  delete streamCache[key];
  return null;
}
function ytmCacheSet(key, data) {
  streamCache[key] = { ts: Date.now(), data };
}

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
  if (!initPromise) initPromise = init().then(() => innertube);
  return initPromise;
}

function thumbUrl(item) {
  if (item.thumbnails && item.thumbnails.length > 0) {
    const t = item.thumbnails[item.thumbnails.length - 1];
    return t.url || t.contentUrl || '';
  }
  if (item.thumbnail && item.thumbnail.length > 0) {
    const t = item.thumbnail[item.thumbnail.length - 1];
    return t.url || t.contentUrl || '';
  }
  if (item.id && item.id.length === 11 && /^[a-zA-Z0-9_-]+$/.test(item.id)) {
    return `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;
  }
  return '';
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

const VARIATION_KEYWORDS = ['remix', 'sped up', 'slowed', 'reverb', 'acoustic', 'live', 'cover', 'version', 'extended', 'edit', 'instrumental', 'karaoke', 'nightcore', 'trap', 'lo-fi', 'lofi', 'piano', 'orchestral', 'unplugged', 'mashup', 'flip', 'bootleg', 'vip'];
const MIX_KEYWORDS = ['mix', 'megamix', 'continuous mix', 'dj mix', 'full album', 'live set', 'compilation', 'medley', 'non-stop', 'nonstop', 'mega mix'];

function stripVariation(title) {
  let clean = title.toLowerCase();
  for (const kw of VARIATION_KEYWORDS) {
    clean = clean.replace(new RegExp(`\\b${kw}\\b`, 'gi'), '');
  }
  clean = clean.replace(/[-()[\]{}!@#$%^&*+=|\\:;"'<>,.?/~`]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean;
}

function isVariation(title) {
  const lower = title.toLowerCase();
  return VARIATION_KEYWORDS.some(kw => lower.includes(kw));
}

function similarity(a, b) {
  const wordsA = a.toLowerCase().split(/\s+/);
  const wordsB = b.toLowerCase().split(/\s+/);
  const intersection = wordsA.filter(w => wordsB.includes(w) && w.length > 2);
  return intersection.length / Math.max(wordsA.length, wordsB.length);
}

async function search(query, type = 'all') {
  const yt = await getInnertube();
  // If type is not 'all', use the specific type for YouTube Music search
  const searchType = type === 'all' ? undefined : type;
  const results = await yt.music.search(query, { type: searchType });

  const allTracks = [];
  const albums = [];
  const artists = [];
  const seenTracks = new Set();
  const seenAlbums = new Set();
  const seenArtists = new Set();

  for (const section of results.contents || []) {
    try {
      if (!section.contents) continue;
      for (const item of section.contents) {
        if (!item || !item.id) continue;
        if (item.type !== 'MusicResponsiveListItem') continue;

        const itemType = item.item_type || '';

        // Filter based on the type parameter
        if (type === 'songs' && itemType !== 'song' && itemType !== 'video') continue;
        if (type === 'albums' && itemType !== 'album') continue;
        if (type === 'artists' && itemType !== 'artist') continue;

        if (itemType === 'song' || itemType === 'video') {
          if (seenTracks.has(item.id)) continue;
          const titleStr = (item.title || '').toString();
          const titleLower = titleStr.toLowerCase();
          const dur = parseDuration(item.duration);
          const isMix = MIX_KEYWORDS.some(kw => titleLower.includes(kw));
          const isLong = dur > 420;
          if (!isMix && !isLong) {
            seenTracks.add(item.id);
            allTracks.push({
              id: item.id,
              title: titleStr || 'Unknown',
              artist: getArtist(item),
              thumbnail: thumbUrl(item),
              duration: dur,
              url: `https://youtube.com/watch?v=${item.id}`,
              type: 'track'
            });
          }
        } else if (itemType === 'album') {
          if (seenAlbums.has(item.id)) continue;
          seenAlbums.add(item.id);
          albums.push({
            id: item.id,
            title: (item.title || 'Unknown').toString(),
            artist: getArtist(item),
            thumbnail: thumbUrl(item),
            trackCount: item.song_count || item.track_count || 0,
            type: 'album'
          });
        } else if (itemType === 'artist') {
          if (seenArtists.has(item.id)) continue;
          seenArtists.add(item.id);
          artists.push({
            id: item.id,
            title: (item.name || item.title || 'Unknown').toString(),
            thumbnail: thumbUrl(item),
            trackCount: 0,
            type: 'artist'
          });
        }
      }
    } catch {}
  }

  let mainTrack = null;
  const variations = [];
  const relatedTracks = [];
  const similarTracks = [];
  const queryLower = query.toLowerCase().trim();
  const usedIds = new Set();

  for (const t of allTracks) {
    const titleLower = t.title.toLowerCase();
    if (!mainTrack && (titleLower.includes(queryLower) || queryLower.includes(titleLower) || similarity(query, t.title) > 0.5)) {
      mainTrack = t;
      usedIds.add(t.id);
      continue;
    }
    if (mainTrack && !usedIds.has(t.id)) {
      const isVar = isVariation(t.title) && (similarity(t.title, mainTrack.title) > 0.4 || t.artist.toLowerCase() === mainTrack.artist.toLowerCase());
      const isSameArtist = t.artist.toLowerCase() === mainTrack.artist.toLowerCase();
      if (isVar || isSameArtist) {
        variations.push(t);
        usedIds.add(t.id);
      }
    }
  }

  for (const t of allTracks) {
    if (usedIds.has(t.id)) continue;
    if (mainTrack && t.artist.toLowerCase() === mainTrack.artist.toLowerCase()) {
      relatedTracks.push(t);
      usedIds.add(t.id);
    }
  }

  for (const t of allTracks) {
    if (usedIds.has(t.id)) continue;
    similarTracks.push(t);
    usedIds.add(t.id);
  }

  return {
    mainTrack,
    variations: variations.slice(0, 6),
    relatedTracks: relatedTracks.slice(0, 10),
    similarTracks: similarTracks.slice(0, 10),
    tracks: allTracks.slice(0, 20),
    albums: albums.slice(0, 4),
    artists: artists.slice(0, 4)
  };
}

async function getRelatedTracks(artistName) {
  const yt = await getInnertube();
  try {
    const results = await yt.music.search(artistName);
    const tracks = [];
    const seen = new Set();
    for (const section of results.contents || []) {
      if (!section.contents) continue;
      for (const item of section.contents) {
        if (!item || !item.id) continue;
        if (item.type !== 'MusicResponsiveListItem') continue;
        const itemType = item.item_type || '';
        if (itemType !== 'song' && itemType !== 'video') continue;
        const titleLower = (item.title || '').toString().toLowerCase();
        const isMix = MIX_KEYWORDS.some(kw => titleLower.includes(kw));
        const dur = parseDuration(item.duration);
        if (dur > 420 || seen.has(item.id) || isMix) continue;
        const artist = getArtist(item);
        if (artist.toLowerCase() !== artistName.toLowerCase()) continue;
        seen.add(item.id);
        tracks.push({
          id: item.id,
          title: (item.title || 'Unknown').toString(),
          artist,
          thumbnail: thumbUrl(item),
          duration: dur,
          url: `https://youtube.com/watch?v=${item.id}`,
          type: 'track'
        });
      }
    }
    return tracks.slice(0, 20);
  } catch { return []; }
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

async function getStreamUrl(videoId) {
  const cacheKey = `stream_${videoId}`;
  const cached = ytmCacheGet(cacheKey);
  if (cached) return cached;
  try {
    const yt = await getInnertube();
    const info = await yt.getInfo(videoId);
    const sd = info.streaming_data;
    if (!sd) return null;
    const formats = [...(sd.adaptive_formats || []), ...(sd.formats || [])];
    // Priority 1: audio/mp4 with AAC codec (required for iOS background playback)
    let audio = formats.find(f => 
      f.mime_type && 
      f.mime_type.includes('audio/mp4') && 
      f.mime_type.includes('codecs="mp4a')
    );
    // Priority 2: any audio/mp4
    if (!audio) {
      audio = formats.find(f => 
        f.mime_type && 
        f.mime_type.startsWith('audio/mp4')
      );
    }
    // Priority 3: any audio format (last resort)
    if (!audio) {
      audio = formats.find(f => 
        f.mime_type && 
        f.mime_type.startsWith('audio/')
      );
    }
    if (audio) {
      let url = null;
      if (audio.url) {
        url = audio.url;
      } else if (audio.decipher) {
        try {
          url = audio.decipher(yt.session.player);
        } catch {}
      }
      if (url) {
        ytmCacheSet(cacheKey, url);
        return url;
      }
    }
    return null;
  } catch (err) {
    console.error('getStreamUrl error for video', videoId, err);
    return null;
  }
}

async function getArtistInfo(artistId) {
  const yt = await getInnertube();
  try {
    const artist = await yt.music.getArtist(artistId);
    if (!artist) return null;

    const result = {
      id: artistId,
      name: artist.name || artist.title || 'Unknown',
      thumbnail: '',
      description: artist.description || '',
      subscribers: artist.subscribers || '',
      songs: [],
      albums: [],
      singles: []
    };

    if (artist.thumbnails && artist.thumbnails.length > 0) {
      const t = artist.thumbnails[artist.thumbnails.length - 1];
      result.thumbnail = t.url || t.contentUrl || '';
    }

    if (artist.songs && artist.songs.contents) {
      for (const item of artist.songs.contents) {
        if (!item || !item.id) continue;
        result.songs.push({
          id: item.id,
          title: item.title || 'Unknown',
          artist: item.artists?.[0]?.name || result.name,
          thumbnail: thumbUrl(item),
          duration: parseDuration(item.duration),
          url: `https://youtube.com/watch?v=${item.id}`,
          type: 'track'
        });
      }
    }
    if (artist.albums && artist.albums.contents) {
      for (const item of artist.albums.contents) {
        if (!item || !item.id) continue;
        result.albums.push({
          id: item.id,
          title: item.title || 'Unknown',
          thumbnail: thumbUrl(item),
          year: item.year || 0,
          type: 'album'
        });
      }
    }

    return result;
  } catch { return null; }
}

module.exports = { search, getVideoInfo, getLyrics, getStreamUrl, getInnertube, getArtistInfo, getRelatedTracks };
