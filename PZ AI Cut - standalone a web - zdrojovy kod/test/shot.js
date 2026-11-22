'use strict';
/* Regresní snímky webové verze v Chrome s ladicím portem (developer-rules 7–8):
 *   chrome --headless=new --remote-debugging-port=9334 --user-data-dir=<profil> http://127.0.0.1:8791/
 *   CDP_PORT=9334 node test/shot.js <šířka> <výška> <soubor.png|-> "<výraz JS (await funguje)>"
 * Nastaví přesnou velikost okna (Emulation), vyhodnotí výraz v aplikaci, vypíše výsledek a uloží snímek. */
const http = require('http');
const fs = require('fs');
const PORT = Number(process.env.CDP_PORT || 9334);
const [w, h, out, expr] = process.argv.slice(2);

const getJson = (p) => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => {
  let b = ''; r.on('data', (d) => { b += d; }); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
}).on('error', rej));

(async () => {
  const list = await getJson('/json');
  const page = list.find((t) => t.type === 'page' && /127\.0\.0\.1:8791\/?$/.test(t.url)) || list.find((t) => t.type === 'page' && /8791/.test(t.url));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: false });
  if (expr) {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true, timeout: 600000 });
    const v = r.result && r.result.result;
    console.log(r.result && r.result.exceptionDetails ? 'CHYBA: ' + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) : JSON.stringify(v && v.value));
  }
  if (out && out !== '-') {
    await new Promise((r) => setTimeout(r, 400));
    const s = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(out, Buffer.from(s.result.data, 'base64'));
    console.log('snímek', out);
  }
  ws.close();
})();
