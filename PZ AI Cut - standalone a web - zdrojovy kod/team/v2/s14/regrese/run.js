'use strict';
// node run.js file.js  -> vyhodnotí tělo souboru jako async funkci v okně PZ AI Cut (CDP_PORT)
const http = require('http'); const fs = require('fs');
const PORT = Number(process.env.CDP_PORT || 9387);
const getJson = (p) => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => { let b = ''; r.on('data', (d) => { b += d; }); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej));
(async () => {
  const list = await getJson('/json');
  const page = list.find((t) => t.type === 'page' && /index\.html/.test(t.url) && !/\/ai\//.test(t.url)) || list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const body = fs.readFileSync(process.argv[2], 'utf8');
  const r = await send('Runtime.evaluate', { expression: `(async () => { ${body}\n })()`, awaitPromise: true, returnByValue: true, timeout: 600000 });
  if (!r.result) { console.log("CDP:", JSON.stringify(r).slice(0, 500)); process.exit(1); }
  if (r.result.exceptionDetails) console.log('CHYBA:', r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || JSON.stringify(r.result.exceptionDetails));
  else { const v = r.result.result.value; console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 1)); }
  ws.close(); process.exit(0);
})();
