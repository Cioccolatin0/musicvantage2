const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

const tmpFile = os.tmpdir() + '\\cmdtest3.out';

// Test 1: no quotes around path
console.log('Test 1: no quotes');
const cmd1 = 'echo hello1 > ' + tmpFile;
console.log('CMD:', cmd1);
const c1 = spawn('cmd.exe', ['/c', cmd1]);
c1.on('close', () => {
  console.log('File exists:', fs.existsSync(tmpFile));
  if (fs.existsSync(tmpFile)) {
    console.log('Content:', fs.readFileSync(tmpFile, 'utf8').trim());
    fs.unlinkSync(tmpFile);
  }
});

// Test 2: with quotes
const tmpFile2 = os.tmpdir() + '\\cmdtest4.out';
const cmd2 = 'echo hello2 > "' + tmpFile2 + '"';
console.log('Test 2: with quotes');
console.log('CMD:', cmd2);
const c2 = spawn('cmd.exe', ['/c', cmd2]);
c2.on('close', () => {
  console.log('File2 exists:', fs.existsSync(tmpFile2));
  if (fs.existsSync(tmpFile2)) {
    console.log('Content2:', fs.readFileSync(tmpFile2, 'utf8').trim());
    fs.unlinkSync(tmpFile2);
  }
});

setTimeout(() => {
  console.log('Test1 file exists after wait:', fs.existsSync(tmpFile));
  console.log('Test2 file exists after wait:', fs.existsSync(tmpFile2));
}, 3000);
