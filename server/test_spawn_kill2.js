const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpFile = path.join(os.tmpdir(), 'testkill.out');

// Spawn ping and kill it with taskkill after 5 seconds
const cmd = 'ping -n 60 127.0.0.1 > ' + tmpFile + ' 2>&1';
console.log('CMD:', cmd);
const child = spawn('cmd.exe', ['/c', cmd], { windowsHide: true });
console.log('Child PID:', child.pid);

const t = setTimeout(() => {
  console.log('Killing child at', Date.now());
  // Use taskkill to forcefully kill the process tree
  const killer = spawn('taskkill', ['/f', '/t', '/pid', child.pid.toString()], { windowsHide: true });
  killer.on('close', (code) => {
    console.log('taskkill exited with code', code);
  });
  killer.on('error', (err) => {
    console.log('taskkill error:', err.message);
  });
}, 5000);

child.on('close', (code, signal) => {
  console.log('Close event at', Date.now(), 'code:', code, 'signal:', signal);
  clearTimeout(t);
  
  try {
    const out = fs.readFileSync(tmpFile, 'utf8');
    console.log('File content:', out.slice(0, 100));
  } catch(e) {
    console.log('File error:', e.message);
  }
  try { fs.unlinkSync(tmpFile); } catch {}
});

child.on('error', (err) => {
  console.log('Error event:', err.message);
});

// Also exit main process after 8 seconds
setTimeout(() => {
  console.log('Main process exiting');
  process.exit(0);
}, 8000);
