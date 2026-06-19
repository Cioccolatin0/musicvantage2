const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = 3002; // different port to avoid conflicts

app.get('/test', async (req, res) => {
  console.log('Request received');
  
  const YTDLP = 'C:\\Users\\Edoardo\\AppData\\Roaming\\Python\\Python313\\Scripts\\yt-dlp.exe';
  const tmpFile = path.join(os.tmpdir(), 'ytdlp_minimal.out');
  const cmd = `"${YTDLP}" --no-warnings --print id --flat-playlist --no-playlist "ytsearch2:hello" > ${tmpFile} 2>&1`;
  
  console.log('CMD:', cmd);
  
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn('cmd.exe', ['/c', cmd], { windowsHide: true });
      const pid = child.pid;
      console.log('Spawned PID:', pid);
      
      const timer = setTimeout(() => {
        console.log('Timeout, killing...');
        spawn('taskkill', ['/f', '/t', '/pid', String(pid)], { windowsHide: true });
        reject(new Error('Timed out'));
      }, 10000);
      
      child.on('close', (code) => {
        console.log('Close, code:', code);
        clearTimeout(timer);
        try {
          const out = fs.readFileSync(tmpFile, 'utf8');
          resolve(out.trim());
        } catch(e) {
          reject(e);
        }
      });
      
      child.on('error', (err) => {
        console.log('Spawn error:', err.message);
        clearTimeout(timer);
        reject(err);
      });
    });
    
    console.log('Result:', result.slice(0, 100));
    res.json({ ok: true, results: result.split('\n').filter(Boolean).length });
  } catch(e) {
    console.log('Error:', e.message);
    res.json({ ok: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Test server on http://localhost:${PORT}`);
});
