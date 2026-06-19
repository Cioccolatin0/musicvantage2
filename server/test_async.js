const { search, getStreamUrl, getVideoInfo } = require('./ytdlp');

async function main() {
  console.log('=== Test Search ===');
  const result = await search('bratz', 'all');
  console.log('Tracks:', result.tracks.length);
  result.tracks.forEach(t => console.log(`  ${t.title} - ${t.artist}`));
  console.log('Albums:', result.albums.length);
  console.log('Artists:', result.artists.length);

  if (result.tracks.length > 0) {
    const id = result.tracks[0].id;
    console.log(`\n=== Test Stream URL for ${id} ===`);
    const url = await getStreamUrl(id);
    console.log('URL:', url ? url.slice(0, 80) + '...' : 'null');
  }
}
main().catch(e => console.log('Fatal:', e.message));
