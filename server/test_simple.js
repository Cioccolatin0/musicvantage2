const express = require('express');
const app = express();

app.get('/ping', (req, res) => {
  console.log('ping received');
  res.json({ ok: true });
});

app.listen(3459, () => {
  console.log('Server on 3459');
});
