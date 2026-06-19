const { exec } = require('child_process');

const p = 'C:\\Users\\Edoardo\\AppData\\Roaming\\Python\\Python313\\Scripts\\yt-dlp.exe';

// Test exec async with timeout
console.log('Starting exec...');
const child = exec(
  `"${p}" --no-warnings --print id --flat-playlist --no-playlist "ytsearch2:hello"`,
  { timeout: 15000, maxBuffer: 10 * 1024 * 1024 },
  (err, stdout, stderr) => {
    if (err) {
      console.log('Error:', err.killed ? 'killed' : err.message.slice(0, 100));
      console.log('Stderr:', (stderr || '').slice(0, 200));
    } else {
      console.log('OK:', stdout.trim());
    }
    console.log('Done at', Date.now());
  }
);
console.log('Child PID:', child.pid);
