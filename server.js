const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3456;

app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

app.listen(PORT, () => {
  console.log(`뭐먹.zip running on port ${PORT}`);
});
