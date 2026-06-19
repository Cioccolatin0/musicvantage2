const { search, getStreamUrl, getVideoInfo } = require('./ytdlp');

async function main() {
  console.log('=== Test Search (should time out gracefully) ===');
  const result = await search('bratz', 'all');
  console.log('Tracks:', result.tracks.length);
  console.log('Albums:', result.albums.length);
  console.log('Artists:', result.artists.length);
  console.log('Expected: all 0 (yt-dlp may be rate-limited, should not crash)');
}
main().catch(e => console.log('Fatal:', e.message));
