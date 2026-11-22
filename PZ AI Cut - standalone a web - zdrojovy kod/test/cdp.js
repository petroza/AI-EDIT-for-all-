'use strict';
// Ladění běžící aplikace přes DevTools protokol (aplikace spuštěná s --remote-debugging-port=9333):
//   node test/cdp.js eval "výraz JS"      – vyhodnotí v hlavním okně (await funguje)
//   node test/cdp.js shot soubor.png       – snímek okna
//   node test/cdp.js key Space|KeyI|...    – stisk klávesy v okně
const http = require('http');
const fs = require('fs');
const PORT = Number(process.env.CDP_PORT || 9333);

function getJson(p) {
  return new Promise((res, rej) => http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => {
    let b = ''; r.on('data', (d) => { b += d; }); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
  }).on('error', rej));
}

async function connect() {
  const list = await getJson('/json');
  const page = list.find((t) => t.type === 'page' && /index\.html/.test(t.url) && !/\/ai\//.test(t.url)) || list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  return { send, close: () => ws.close() };
}

(async () => {
  const [cmd, arg, arg2] = process.argv.slice(2);
  const c = await connect();
  try {
    if (cmd === 'eval') {
      const r = await c.send('Runtime.evaluate', { expression: `(async () => { return (${arg}); })()`, awaitPromise: true, returnByValue: true });
      if (r.result.exceptionDetails) console.log('CHYBA:', r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || JSON.stringify(r.result.exceptionDetails));
      else console.log(typeof r.result.result.value === 'string' ? r.result.result.value : JSON.stringify(r.result.result.value, null, 1));
    } else if (cmd === 'shot') {
      const r = await c.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(arg, Buffer.from(r.result.data, 'base64'));
      console.log('uloženo', arg);
    } else if (cmd === 'key') {
      const mods = (arg2 || '').split('+').filter(Boolean);
      const m = (mods.includes('Ctrl') ? 2 : 0) | (mods.includes('Shift') ? 8 : 0) | (mods.includes('Alt') ? 1 : 0);
      const key = arg.replace(/^Key/, '').toLowerCase();
      for (const type of ['keyDown', 'keyUp']) await c.send('Input.dispatchKeyEvent', { type, code: arg, key: arg === 'Space' ? ' ' : key, modifiers: m });
      console.log('ok');
    } else if (cmd === 'move') {
      const [x, y] = arg.split(',').map(Number);
      await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
      console.log('ok');
    } else if (cmd === 'drag') {
      // node test/cdp.js drag "x1,y1,x2,y2" [Ctrl|Alt|Shift]
      const [x1, y1, x2, y2] = arg.split(',').map(Number);
      const mods = (arg2 || '').split('+').filter(Boolean);
      const m = (mods.includes('Ctrl') ? 2 : 0) | (mods.includes('Shift') ? 8 : 0) | (mods.includes('Alt') ? 1 : 0);
      const ev = (type, x, y, extra = {}) => c.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', modifiers: m, clickCount: 1, ...extra });
      await ev('mouseMoved', x1, y1, { button: 'none' });
      await ev('mousePressed', x1, y1);
      for (let i = 1; i <= 8; i++) await ev('mouseMoved', x1 + (x2 - x1) * i / 8, y1 + (y2 - y1) * i / 8);
      await ev('mouseReleased', x2, y2);
      console.log('ok');
    } else if (cmd === 'logs') {
      await c.send('Runtime.enable');
      console.log('(logy se vypisují jen během běhu – použij eval)');
    }
  } finally { c.close(); }
})().catch((e) => { console.error('CDP:', e.message); process.exit(1); });
