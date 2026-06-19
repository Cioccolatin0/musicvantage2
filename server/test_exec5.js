const { execFileSync } = require('child_process');
const p = 'C:\\Users\\Edoardo\\AppData\\Roaming\\Python\\Python313\\Scripts\\yt-dlp.exe';

// Test search without "audio" suffix
console.log('=== Test 1: no audio suffix ===');
try {
  const r = execFileSync(p, ['--no-warnings', '--dump-json', '--flat-playlist', '--no-playlist', 'ytsearch3:bratz'], { timeout:20000, encoding:'utf8', maxBuffer: 10*1024*1024 });
  const lines = r.trim().split('\n').filter(Boolean);
  console.log('Results:', lines.length);
  lines.forEach((l, i) => { try { const d = JSON.parse(l); console.log(`  ${i+1}. ${d.title} - ${d.uploader}`); } catch {} });
} catch(e) {
  console.log('ERR:', (e.stderr || e.message || '').slice(0,300));
}

// Test search with " audio" suffix
console.log('\n=== Test 2: with audio suffix ===');
try {
  const r = execFileSync(p, ['--no-warnings', '--dump-json', '--flat-playlist', '--no-playlist', 'ytsearch3:bratz audio'], { timeout:20000, encoding:'utf8', maxBuffer: 10*1024*1024 });
  const lines = r.trim().split('\n').filter(Boolean);
  console.log('Results:', lines.length);
  lines.forEach((l, i) => { try { const d = JSON.parse(l); console.log(`  ${i+1}. ${d.title} - ${d.uploader}`); } catch {} });
} catch(e) {
  console.log('ERR:', (e.stderr || e.message || '').slice(0,300));
}

// Test get-stream-url equivalent
console.log('\n=== Test 3: get-url ===');
try {
  const r = execFileSync(p, ['--no-warnings', '-f', 'bestaudio[ext=m4a]/bestaudio/best', '--get-url', '--no-playlist', 'https://www.youtube.com/watch?v=tNrXdl2X4ZQ'], { timeout:20000, encoding:'utf8', maxBuffer: 10*1024*1024 });
  const url = r.trim().split('\n')[0];
  console.log('URL:', url ? url.slice(0,100) + '...' : 'empty');
} catch(e) {
  console.log('ERR:', (e.stderr || e.message || '').slice(0,300));
}
