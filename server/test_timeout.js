const { execSync } = require('child_process');

// Test timeout with a simple long-running command
console.time('test');
try {
  // ping localhost for 30 seconds with 5 second timeout
  execSync('ping -n 30 127.0.0.1', { timeout: 5000, encoding: 'utf8' });
  console.log('Completed');
} catch(e) {
  console.log('ERR after', (e.killed ? 'killed' : 'error'), ':', e.message.split('\n')[0]);
}
console.timeEnd('test');
