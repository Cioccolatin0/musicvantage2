const { execSync, execFileSync, spawnSync } = require('child_process');
const p = 'C:\\Users\\Edoardo\\AppData\\Roaming\\Python\\Python313\\Scripts\\yt-dlp.exe';
const args = ['--no-warnings', '--dump-json', '--flat-playlist', '--no-playlist', 'ytsearch1:bratz'];

// execSync with shell (default)
console.log('--- execSync (shell) ---');
try {
  const cmd = '"' + p + '" ' + args.map(a => a.includes(' ') ? '"' + a + '"' : a).join(' ');
  const r = execSync(cmd, { timeout:20000, encoding:'utf8' });
  console.log('OK:', r.slice(0,200));
} catch(e) {
  console.log('ERR:', (e.stderr || e.message || '').slice(0,300));
}

// execFileSync (no shell)
console.log('--- execFileSync (no shell) ---');
try {
  const r2 = execFileSync(p, args, { timeout:20000, encoding:'utf8' });
  console.log('OK:', r2.slice(0,200));
} catch(e2) {
  console.log('ERR:', (e2.stderr || e2.message || '').slice(0,300));
}
