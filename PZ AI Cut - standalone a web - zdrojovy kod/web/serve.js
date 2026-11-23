'use strict';
/* Místní testovací server webové verze (jen 127.0.0.1): node web/serve.js [port]
 * Servíruje web/dist. Pro automatické testy navíc /devfile?p=<cesta> vrátí místní video (jen z povolených složek). */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2]) || 8791;
const DIST = process.env.PZ_DIST ? path.resolve(process.env.PZ_DIST) : path.join(__dirname, 'dist'); // PZ_DIST = jiná verze (měření PŘED)
const ALLOW = [path.join(process.env.USERPROFILE || 'C:\\', 'Downloads'), 'O:\\STRIH TEST', 'O:\\TN_strihatko\\test'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.json': 'application/json' };

http.createServer((req, res) => {
  // vývojový server: jen místní Host (DNS rebinding) a zápis jen ze stejné stránky (bezpečnost S12)
  const host = String(req.headers.host || '').replace(/:\d+$/, '').toLowerCase();
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) { res.writeHead(403); res.end('forbidden'); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const o = req.headers.origin;
    if (o && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(o)) { res.writeHead(403); res.end('forbidden'); return; }
  }
  const u = new URL(req.url, 'http://x');
  let file;
  if (u.pathname === '/devsave' && req.method === 'POST') {
    // jen testy: výsledek exportu z prohlížeče -> složka web/test-out (mimo dist, nenasazuje se)
    const dir = require('path').join(__dirname, 'test-out');
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, path.basename(u.searchParams.get('name') || 'out.mp4'));
    const w = fs.createWriteStream(out);
    req.pipe(w);
    w.on('finish', () => { res.writeHead(200); res.end(out); });
    return;
  }
  if (u.pathname === '/devfile') {
    file = path.resolve(u.searchParams.get('p') || '');
    if (!ALLOW.some((a) => file.toLowerCase().startsWith(a.toLowerCase()))) { res.writeHead(403); res.end('forbidden'); return; }
  } else {
    file = path.join(DIST, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
    if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end('not found'); return; }
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range && /bytes=(\d+)-(\d*)/.exec(req.headers.range);
    if (range) {
      const a = Number(range[1]), b = range[2] ? Number(range[2]) : st.size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1, 'Accept-Ranges': 'bytes' });
      fs.createReadStream(file, { start: a, end: b }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'credentialless' });
      fs.createReadStream(file).pipe(res);
    }
  });
}).listen(PORT, '127.0.0.1', () => console.log(`PZ AI Cut Web: http://127.0.0.1:${PORT}/`));
