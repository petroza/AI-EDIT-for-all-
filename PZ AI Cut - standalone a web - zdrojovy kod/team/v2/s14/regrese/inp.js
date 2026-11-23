'use strict';
// node inp.js click x,y | type "text" | key Enter
const http = require('http');
const PORT = Number(process.env.CDP_PORT || 9387);
const getJson = (p) => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => { let b = ''; r.on('data', (d) => { b += d; }); r.on('end', () => res(JSON.parse(b))); }).on('error', rej));
(async () => {
  const list = await getJson('/json');
  const page = list.find((t) => t.type === 'page' && /index\.html/.test(t.url) && !/\/ai\//.test(t.url));
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => { ws.onopen = r; });
  let id = 0; const pend = new Map(); ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'click') { const [x, y] = arg.split(',').map(Number); for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 }); }
  if (cmd === 'type') await send('Input.insertText', { text: arg });
  if (cmd === 'key') { const vk = { Enter: 13, Escape: 27 }[arg]; for (const type of ['rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: arg, code: arg, windowsVirtualKeyCode: vk, ...(type === 'rawKeyDown' && arg === 'Enter' ? { text: '\r' } : {}) }); }
  console.log('ok'); ws.close(); process.exit(0);
})();
