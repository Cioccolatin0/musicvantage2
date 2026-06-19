const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const p = 'C:\\Users\\Edoardo\\AppData\\Roaming\\Python\\Python313\\Scripts\\yt-dlp.exe';
const tmpFile = path.join(os.tmpdir(), `ytdlp_test_${Date.now()}.out`);

try {
  // Redirect stdout to a temp file using cmd.exe
  const cmd = `"${p}" --no-warnings --print id --flat-playlist --no-playlist "ytsearch2:hello" > "${tmpFile}"`;
  console.log('CMD:', cmd);
  console.time('exec');
  execSync(cmd, { timeout:20000, stdio: ['ignore', 'ignore', 'pipe'] });
  console.timeEnd('exec');
  
  // Read the temp file
  const out = fs.readFileSync(tmpFile, 'utf8').trim();
  console.log('Output:', out);
  console.log('Lines:', out.split('\n').filter(Boolean).length);
} catch(e) {
  console.log('ERR:', e.message.split('\n')[0]);
} finally {
  try { fs.unlinkSync(tmpFile); } catch {}
}
