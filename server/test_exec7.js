const { execSync } = require('child_process');
const p = 'C:\\Users\\Edoardo\\AppData\\Roaming\\Python\\Python313\\Scripts\\yt-dlp.exe';

console.time('total');
try {
  const cmd = `"${p}" --no-warnings --print id --flat-playlist --no-playlist "ytsearch2:hello"`;
  console.log('CMD:', cmd);
  const r = execSync(cmd, { timeout:20000, encoding:'utf8', maxBuffer:10*1024*1024 });
  console.log('OK:', r.trim());
} catch(e) {
  console.log('ERR:', e.message.split('\n')[0]);
  console.log('stderr:', (e.stderr || '').slice(0,300));
}
console.timeEnd('total');
