const { execFileSync, execSync } = require('child_process');
const p = 'C:\\Users\\Edoardo\\AppData\\Roaming\\Python\\Python313\\Scripts\\yt-dlp.exe';

// Test 1: --print id (same as what worked in PowerShell)
try {
  console.log('Test 1: execFileSync with --print id');
  const r = execFileSync(p, ['--no-warnings', '--print', 'id', '--flat-playlist', '--no-playlist', 'ytsearch2:hello'], { timeout:20000, encoding:'utf8' });
  console.log('OK:', r.trim());
} catch(e) { console.log('ERR:', e.message.split('\n')[0]); }

// Test 2: execSync (with shell)
try {
  console.log('\nTest 2: execSync with shell');
  const cmd = `"${p}" --no-warnings --print id --flat-playlist --no-playlist "ytsearch2:hello"`;
  const r = execSync(cmd, { timeout:20000, encoding:'utf8' });
  console.log('OK:', r.trim());
} catch(e) { console.log('ERR:', e.message.split('\n')[0]); }

// Test 3: execFileSync with --print id but ytsearch1
try {
  console.log('\nTest 3: execFileSync ytsearch1:bratz');
  const r = execFileSync(p, ['--no-warnings', '--print', 'id', '--flat-playlist', '--no-playlist', 'ytsearch1:bratz'], { timeout:20000, encoding:'utf8' });
  console.log('OK:', r.trim());
} catch(e) { console.log('ERR:', e.message.split('\n')[0]); }
