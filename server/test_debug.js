const { execFileSync } = require('child_process');
const p = 'C:\\Users\\Edoardo\\AppData\\Roaming\\Python\\Python313\\Scripts\\yt-dlp.exe';
const args = ['--no-warnings', '--print', '%(id)s|%(title)s|%(uploader)s|%(duration)s', '--flat-playlist', '--no-playlist', 'ytsearch3:bratz audio'];

try {
  console.log('Running:', p, args.join(' '));
  const r = execFileSync(p, args, { timeout:20000, encoding:'utf8', maxBuffer:10*1024*1024, stdio:['ignore','pipe','pipe'] });
  console.log('Output:', JSON.stringify(r));
  console.log('Lines:', r.trim().split('\n').filter(Boolean).length);
  console.log('First:', r.trim().split('\n')[0]);
} catch(e) {
  console.log('Error:', e.message);
  console.log('Stderr:', (e.stderr || '').slice(0,500));
  console.log('Stdout:', (e.stdout || '').slice(0,500));
}
