const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmpFile = path.join(os.tmpdir(), 'cmdtest.out');
const cmd = 'echo hello world > "' + tmpFile + '" 2>&1';

console.log('CMD:', cmd);
const child = spawn('cmd.exe', ['/c', cmd]);

child.on('close', () => {
  const out = fs.readFileSync(tmpFile, 'utf8');
  console.log('Output:', out.trim());
  fs.unlinkSync(tmpFile);
});

child.on('error', (err) => {
  console.log('Error:', err.message);
});

// Kill after 5 seconds to test timeout
setTimeout(() => {
  console.log('Killing...');
  child.kill('SIGKILL');
  // Check if process is actually gone
  setTimeout(() => {
    console.log('Process killed?');
    try {
      const out = fs.readFileSync(tmpFile, 'utf8');
      console.log('File after kill:', JSON.stringify(out));
    } catch(e) {
      console.log('File error:', e.message);
    }
  }, 1000);
}, 5000);
