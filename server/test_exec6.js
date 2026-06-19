const { execFileSync } = require('child_process');
const p = 'C:\\Users\\Edoardo\\AppData\\Roaming\\Python\\Python313\\Scripts\\yt-dlp.exe';

// Test with different query
console.log('=== Test get-url first ===');
try {
  const r = execFileSync(p, ['--no-warnings', '-f', 'bestaudio[ext=m4a]/bestaudio/best', '--get-url', '--no-playlist', 'https://www.youtube.com/watch?v=tNrXdl2X4ZQ'], { timeout:20000, encoding:'utf8' });
  console.log('URL OK:', r.trim().slice(0,100));
} catch(e) {
  console.log('URL ERR:', (e.stderr || e.message || '').slice(0,300));
}

// Search with unique query
const q = 'eminem lose yourself';
console.log('\n=== Test search ===');
try {
  const r = execFileSync(p, ['--no-warnings', '--dump-json', '--flat-playlist', '--no-playlist', 'ytsearch1:' + q], { timeout:20000, encoding:'utf8' });
  console.log('Search OK:', r.slice(0,200));
} catch(e) {
  console.log('Search ERR:', (e.stderr || e.message || '').slice(0,300));
}
