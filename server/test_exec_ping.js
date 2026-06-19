const { exec } = require('child_process');

// Test exec async timeout with ping
console.log('Starting exec ping...');
const child = exec(
  'ping -n 60 127.0.0.1',
  { timeout: 5000 },
  (err, stdout, stderr) => {
    if (err) {
      console.log('Error:', err.killed ? 'killed (timeout worked!)' : err.message.slice(0, 100));
      if (err.stderr) console.log('Stderr:', err.stderr);
    } else {
      console.log('Completed (no timeout)');
    }
    console.log('Callback at', Date.now());
  }
);
console.log('Child PID:', child.pid, 'at', Date.now());
