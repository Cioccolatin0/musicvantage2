const { getInnertube, search: ytSearch } = require('./ytmusic');
const crypto = require('crypto');
const db = require('./db');

async function savePlaylist(playlist) {
  await db.query(
    `INSERT INTO playlists (id, name, source, source_url, tracks, created)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     ON CONFLICT (id) DO UPDATE SET
       name = $2, source = $3, source_url = $4, tracks = $5::jsonb`,
    [playlist.id, playlist.name, playlist.source, playlist.sourceUrl,
     JSON.stringify(playlist.tracks), playlist.created]
  );
}

async function loadPlaylist(id) {
  const { rows } = await db.query('SELECT * FROM playlists WHERE id = $1', [id]);
  if (rows.length === 0) return null;
  const r = rows[0];
  return { id: r.id, name: r.name, source: r.source, sourceUrl: r.source_url, tracks: r.tracks, created: r.created };
}

async function listPlaylists() {
  const { rows } = await db.query(
    'SELECT id, name, source, source_url, jsonb_array_length(tracks) AS count, created FROM playlists ORDER BY created DESC'
  );
  return rows.map(r => ({
    id: r.id, name: r.name, source: r.source, sourceUrl: r.source_url, count: r.count, created: r.created
  }));
}

async function deletePlaylist(id) {
  const { rowCount } = await db.query('DELETE FROM playlists WHERE id = $1', [id]);
  return rowCount > 0;
}

async function ytSearchOne(query) {
  const results = await ytSearch(query);
  if (results.mainTrack) {
    return { id: results.mainTrack.id, title: results.mainTrack.title, uploader: results.mainTrack.artist, duration: results.mainTrack.duration };
  }
  if (results.tracks && results.tracks.length > 0) {
    const t = results.tracks[0];
    return { id: t.id, title: t.title, uploader: t.artist, duration: t.duration };
  }
  return null;
}

async function importFromYoutube(url) {
  const playlistId = url.match(/list=([a-zA-Z0-9_-]+)/)?.[1];
  if (!playlistId) throw new Error('Invalid YouTube playlist URL');

  const yt = await getInnertube();
  let playlistInfo;
  try { playlistInfo = await yt.getPlaylist(playlistId); } catch { playlistInfo = null; }
  const name = playlistInfo?.title || 'YouTube Playlist';

  let tracks = [];
  if (playlistInfo?.videos) {
    for (const v of playlistInfo.videos) {
      if (v.id) {
        tracks.push({
          id: v.id,
          title: v.title?.text || v.title || 'Unknown',
          artist: v.short_byline_text?.runs?.[0]?.text || 'Unknown',
          thumbnail: v.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
          duration: v.length_seconds ? parseInt(v.length_seconds) : 0,
          url: `https://youtube.com/watch?v=${v.id}`,
          type: 'track'
        });
      }
    }
  }

  if (tracks.length === 0) {
    throw new Error('Could not extract tracks from YouTube playlist');
  }

  return { tracks, name };
}



async function importFromAppleMusic(url) {
  const html = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(15000)
  }).then(r => r.text()).catch(() => '');

  if (!html) throw new Error('Could not fetch Apple Music page');

  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const name = titleMatch
    ? titleMatch[1].replace(/\s*on Apple Music\s*/i, '').trim()
    : 'Apple Music Playlist';

  let songData = [];
  try {
    const scriptMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/);
    if (scriptMatch) {
      const data = JSON.parse(scriptMatch[1]);
      const sections = data?.sections ?? data?.store?.sections ?? [];
      for (const section of sections) {
        for (const item of section?.items ?? []) {
          if (item?.attributes?.name && item?.attributes?.artistName) {
            songData.push({
              name: item.attributes.name,
              artist: item.attributes.artistName
            });
          }
        }
      }
    }
  } catch {}

  if (songData.length === 0) {
    const ldMatch = html.match(/<script type="application\/ld\+json">(.+?)<\/script>/);
    if (ldMatch) {
      try {
        const ld = JSON.parse(ldMatch[1]);
        const items = ld?.track?.itemListElement ?? [];
        for (const item of items) {
          if (item?.item?.name) {
            songData.push({
              name: item.item.name,
              artist: item.item.byArtist?.name || 'Unknown'
            });
          }
        }
      } catch {}
    }
  }

  const tracks = [];
  const BATCH = 5;
  for (let i = 0; i < songData.length; i += BATCH) {
    const batch = songData.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(async (s) => {
      const query = `${s.name} ${s.artist}`;
      const yt = await ytSearchOne(query);
      if (!yt) return null;
      return {
        id: yt.id,
        title: s.name,
        artist: s.artist,
        thumbnail: `https://i.ytimg.com/vi/${yt.id}/hqdefault.jpg`,
        duration: yt.duration || 0,
        url: `https://youtube.com/watch?v=${yt.id}`,
        type: 'track'
      };
    }));
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) tracks.push(r.value);
    }
  }

  if (tracks.length === 0) throw new Error('Could not extract tracks from Apple Music page');
  return { tracks, name, sourceName: `Apple Music — ${name}` };
}

async function importFromTracks(trackList) {
  const tracks = [];
  const BATCH = 5;
  for (let i = 0; i < trackList.length; i += BATCH) {
    const batch = trackList.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(async (item) => {
      const query = typeof item === 'string' ? item : `${item.title || ''} ${item.artist || ''}`;
      if (!query.trim()) return null;
      const yt = await ytSearchOne(query);
      if (!yt) return null;
      return {
        id: yt.id,
        title: typeof item === 'string' ? query : item.title || yt.title || 'Unknown',
        artist: typeof item === 'object' ? (item.artist || yt.uploader || 'Unknown') : (yt.uploader || 'Unknown'),
        thumbnail: `https://i.ytimg.com/vi/${yt.id}/hqdefault.jpg`,
        duration: yt.duration || 0,
        url: `https://youtube.com/watch?v=${yt.id}`,
        type: 'track'
      };
    }));
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) tracks.push(r.value);
    }
  }
  return { tracks, name: 'Custom List' };
}

async function importFromSpotify(url) {
  const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
  if (!match) throw new Error('Invalid Spotify playlist URL');
  const playlistId = match[1];

  const html = await fetch(`https://open.spotify.com/playlist/${playlistId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    signal: AbortSignal.timeout(30000)
  }).then(r => r.text()).catch(() => '');

  if (!html) throw new Error('Could not fetch Spotify page');

  let name = 'Spotify Playlist';
  let songData = [];

  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  if (titleMatch) name = titleMatch[1].replace(/\s*\|\s*Spotify\s*$/i, '').trim();

  try {
    const ldMatch = html.match(/<script type="application\/ld\+json"[^>]*>([^<]+)<\/script>/);
    if (ldMatch) {
      const ld = JSON.parse(ldMatch[1].trim());
      const items = ld?.track?.itemListElement ?? [];
      for (const item of items) {
        if (item?.item?.name) {
          songData.push({
            name: item.item.name,
            artist: item.item.byArtist?.name || 'Unknown'
          });
        }
      }
    }
  } catch {}

  if (songData.length === 0) {
    const parts = html.split('"trackName"');
    for (let i = 1; i < parts.length; i++) {
      try {
        const part = parts[i].slice(0, 200);
        const nameM = part.match(/"trackName"\s*:\s*"([^"]+)"/);
        const artM = part.match(/"artistName"\s*:\s*"([^"]+)"/);
        if (nameM) {
          songData.push({
            name: nameM[1],
            artist: artM ? artM[1] : 'Unknown'
          });
        }
      } catch {}
    }
  }

  if (songData.length === 0) {
    const re = /"trackName":"([^"]+)","artistName":"([^"]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      songData.push({ name: m[1], artist: m[2] });
    }
  }

  const seen = new Set();
  songData = songData.filter(s => {
    const k = `${s.name}|${s.artist}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (songData.length === 0) throw new Error('Could not extract tracks from Spotify page');

  const tracks = [];
  const BATCH = 5;
  for (let i = 0; i < songData.length; i += BATCH) {
    const batch = songData.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(async (s) => {
      const query = `${s.name} ${s.artist}`;
      const yt = await ytSearchOne(query);
      if (!yt) return null;
      return {
        id: yt.id,
        title: s.name,
        artist: s.artist,
        thumbnail: `https://i.ytimg.com/vi/${yt.id}/hqdefault.jpg`,
        duration: yt.duration || 0,
        url: `https://youtube.com/watch?v=${yt.id}`,
        type: 'track'
      };
    }));
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) tracks.push(r.value);
    }
  }

  return { tracks, name, sourceName: `Spotify — ${name}` };
}

function detectSource(url) {
  if (/youtube\.com\/playlist|youtu\.be\/playlist|music\.youtube/.test(url)) return 'youtube';
  if (/spotify\.com\/playlist/.test(url)) return 'spotify';
  if (/music\.apple\.com/.test(url)) return 'apple-music';
  return null;
}

async function importPlaylist({ url, tracks }) {
  let result;

  if (url) {
    const source = detectSource(url);
    switch (source) {
      case 'youtube':
        result = await importFromYoutube(url);
        break;
      case 'spotify':
        result = await importFromSpotify(url);
        break;
      case 'apple-music':
        result = await importFromAppleMusic(url).catch(() => { throw new Error('Apple Music import failed — the page format may have changed'); });
        break;
      default:
        throw new Error('Unsupported URL. Supported: YouTube/YT Music, Spotify (needs env vars), Apple Music (best effort).');
    }
    result.source = source;
    result.sourceUrl = url;
  } else if (tracks && Array.isArray(tracks) && tracks.length > 0) {
    result = await importFromTracks(tracks);
    result.source = 'custom';
    result.sourceUrl = null;
  } else {
    throw new Error('Provide a URL or an array of track names');
  }

  const playlist = {
    id: crypto.randomUUID(),
    name: result.sourceName || result.name,
    source: result.source || 'unknown',
    sourceUrl: result.sourceUrl,
    tracks: result.tracks,
    created: Date.now()
  };

  await savePlaylist(playlist);
  return playlist;
}

module.exports = { importPlaylist, listPlaylists, loadPlaylist, deletePlaylist };
