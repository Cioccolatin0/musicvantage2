console.log('Starting timer test at', Date.now());
setTimeout(() => {
  console.log('Timer fired at', Date.now());
  console.log('Timer test passed - timers work');
  process.exit(0);
}, 3000);
