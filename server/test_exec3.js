const { execSync } = require('child_process');
const p = 'C:\\Users\\Edoardo\\AppData\\Roaming\\Python\\Python313\\Scripts\\yt-dlp.exe';
try {
  // Use the same args that work directly
  const r = execSync('"' + p + '" --no-warnings --dump-json --flat-playlist --no-playlist "ytsearch1:bratz"', { timeout:20000, encoding:'utf8' });
  console.log('OK:', r.slice(0,200));
} catch(e) {
  console.log('ERR:', e.stderr ? e.stderr.slice(0,300) : e.message.slice(0,300));
}
