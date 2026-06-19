const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpFile = path.join(os.tmpdir(), 'testkill.out');

// Spawn a long-running cmd.exe command and kill it after 5 seconds
const cmd = 'ping -n 60 127.0.0.1 > ' + tmpFile + ' 2>&1';
console.log('CMD:', cmd);
const child = spawn('cmd.exe', ['/c', cmd], { windowsHide: true });

console.log('Child PID:', child.pid);

const t = setTimeout(() => {
  console.log('Killing child at', Date.now());
  const killed = child.kill('SIGKILL');
  console.log('Killed:', killed);
  
  // Check if process is dead after kill
  setTimeout(() => {
    try {
      const out = fs.readFileSync(tmpFile, 'utf8');
      console.log('File content (after kill):', out.slice(0, 100));
    } catch(e) {
      console.log('File error:', e.message);
    }
    try { fs.unlinkSync(tmpFile); } catch {}
  }, 1000);
}, 5000);

child.on('close', (code, signal) => {
  console.log('Close event at', Date.now(), 'code:', code, 'signal:', signal);
  clearTimeout(t);
});

child.on('error', (err) => {
  console.log('Error event:', err.message);
});
