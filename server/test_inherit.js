const { spawn } = require('child_process');
const YTDLP = 'C:\\Users\\Edoardo\\AppData\\Roaming\\Python\\Python313\\Scripts\\yt-dlp.exe';
const args = ['--no-warnings', '--print', 'id', '--flat-playlist', '--no-playlist', 'ytsearch2:hello'];

console.log('Starting with inherit...');
const child = spawn(YTDLP, args, { stdio: ['ignore', 'inherit', 'inherit'] });

child.on('close', (code) => {
  console.log('\nClose code:', code);
});

child.on('error', (err) => {
  console.log('Error:', err.message);
});
