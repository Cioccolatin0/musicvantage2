const { execFileSync } = require('child_process');
const p = 'C:\\Users\\Edoardo\\AppData\\Roaming\\Python\\Python313\\Scripts\\yt-dlp.exe';

const queries = ['ytsearch1:hello', 'ytsearch1:bratz', 'ytsearch3:bratz audio'];
for (const q of queries) {
  try {
    console.log(`\nQuery: ${q}`);
    const r = execFileSync(p, ['--no-warnings', '--print', '%(id)s|%(title)s|%(uploader)s|%(duration)s', '--flat-playlist', '--no-playlist', q], { timeout:15000, encoding:'utf8', maxBuffer:10*1024*1024 });
    console.log('OK:', r.trim().split('\n').filter(Boolean).length, 'results');
  } catch(e) {
    console.log('ERR:', e.message.split('\n')[0]);
  }
}
