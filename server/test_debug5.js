const { spawn } = require('child_process');
const YTDLP = 'C:\\Users\\Edoardo\\AppData\\Roaming\\Python\\Python313\\Scripts\\yt-dlp.exe';

function runYtDlp(args, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let done = false;

    const timer = setTimeout(() => {
      if (!done) { done = true; child.kill('SIGKILL'); reject(new Error('Timed out')); }
    }, timeout);

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      if (done) return; done = true; clearTimeout(timer);
      console.log(`Exit code: ${code}, stdout: ${stdout.length} chars, stderr: ${stderr.length} chars`);
      if (stderr) console.log('STDERR:', stderr.slice(0,500));
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `Exit code ${code}`));
    });

    child.on('error', (err) => {
      if (done) return; done = true; clearTimeout(timer);
      reject(err);
    });
  });
}

async function main() {
  // Test 1: simple --print id (this worked in PowerShell)
  console.log('Test 1: --print id');
  try {
    const r = await runYtDlp(['--no-warnings', '--print', 'id', '--flat-playlist', '--no-playlist', 'ytsearch2:hello'], 20000);
    console.log('Result:', r);
  } catch(e) { console.log('ERR:', e.message); }
  
  // Test 2: full print format
  console.log('\nTest 2: --print with format');
  try {
    const r = await runYtDlp(['--no-warnings', '--print', '%(id)s|%(title)s|%(uploader)s|%(duration)s', '--flat-playlist', '--no-playlist', 'ytsearch2:hello'], 20000);
    console.log('Result:', r);
  } catch(e) { console.log('ERR:', e.message); }
}
main().catch(e => console.log('Fatal:', e.message));
