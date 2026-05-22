const express = require('express');
const path    = require('path');
const https   = require('https');

const app  = express();
const PORT = process.env.PORT || 3456;

const NAVER_CLIENT_ID     = process.env.NAVER_CLIENT_ID     || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';

app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

// ── 네이버 지역 검색 프록시 ──
// 브라우저에서 직접 호출하면 CORS 에러 → 서버가 대신 호출
app.get('/api/search', (req, res) => {
  const { query, display = '5', start = '1' } = req.query;
  if (!query) return res.json({ items: [] });

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return res.status(503).json({ error: 'NAVER API 키가 설정되지 않았습니다.' });
  }

  const params = new URLSearchParams({ query, display, start, sort: 'comment' });
  const options = {
    hostname: 'openapi.naver.com',
    path:     `/v1/search/local.json?${params}`,
    headers: {
      'X-Naver-Client-Id':     NAVER_CLIENT_ID,
      'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
    },
  };

  https.get(options, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      try {
        res.json(JSON.parse(data));
      } catch (e) {
        res.status(500).json({ error: 'parse error', raw: data.slice(0, 200) });
      }
    });
  }).on('error', e => res.status(500).json({ error: e.message }));
});

app.listen(PORT, () => {
  console.log(`뭐먹.zip running on port ${PORT}`);
});
