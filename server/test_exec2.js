const { execSync } = require('child_process');
const p = 'C:\\Users\\Edoardo\\AppData\\Roaming\\Python\\Python313\\Scripts\\yt-dlp.exe';
try {
  const r = execSync('"' + p + '" --no-warnings --dump-json --flat-playlist --no-playlist "ytsearch1:bratz audio"', { timeout:15000, encoding:'utf8' });
  console.log('OK:', r.slice(0,300));
} catch(e) {
  console.log('ERR:', e.stderr ? e.stderr.slice(0,300) : e.message.slice(0,300));
}
