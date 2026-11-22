'use strict';
/* Konektor drží relaci AI v jedné kartě (kolo 7): úkol nejde kartě s fokusem, ale té, kde AI začala;
 * jinam jen po zadání z panelu v jiné kartě (s upozorněním pro AI).  node test/connector-pin.js */
const { spawn } = require('child_process');
const path = require('path');
const ORIGIN = 'http://127.0.0.1:8791';
const proc = spawn(process.execPath, [path.join(__dirname, '..', 'connector', 'server', 'index.js')],
  { stdio: ['pipe', 'pipe', 'pipe'], env: Object.assign({}, process.env, { PZ_CONNECTOR_ORIGINS: ORIGIN }) });
let port = null, buf = '', id = 0;
const waiting = new Map();
proc.stderr.on('data', (d) => { const m = /listening on 127\.0\.0\.1:(\d+)/.exec(String(d)); if (m) port = Number(m[1]); });
proc.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const msg = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); const w = waiting.get(msg.id); if (w) { waiting.delete(msg.id); w(msg); } } });
const rpc = (method, params) => new Promise((res) => { const k = ++id; waiting.set(k, res); proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: k, method, params }) + '\n'); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// falešná karta: dlouhé dotazy /next, na úkol odpoví svým jménem
function tab(name, st) {
  (async () => {
    while (!st.stop) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/next?tab=${name}&act=${st.act}${st.task ? '&task=1' : ''}`, { headers: { Origin: ORIGIN } });
        const job = await r.json();
        if (job && job.tool) await fetch(`http://127.0.0.1:${port}/result`, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: job.id, ok: true, result: 'tab ' + name }) });
      } catch (e) { await sleep(200); }
    }
  })();
}
const call = async () => { const r = await rpc('tools/call', { name: 'editor_status', arguments: {} }); return r.result.content[0].text; };
(async () => {
  let ok = true;
  const check = (label, cond, got) => { console.log(`${cond ? '✔' : '✖'} ${label}${cond ? '' : ' – ' + got}`); if (!cond) ok = false; };
  for (let k = 0; k < 50 && !port; k++) await sleep(100);
  await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  const A = { act: 1000 }, B = { act: 0 };
  tab('A', A); await sleep(300);
  let r = await call(); check('první úkol jde do jediné karty A', /^tab A$/.test(r), r);
  tab('B', B); B.act = Date.now(); await sleep(300); // uživatel se přepnul do karty B (fokus)
  r = await call(); check('karta B s fokusem úkol nepřebere (relace zůstává v A)', /^tab A$/.test(r), r);
  r = await call(); check('ani další', /^tab A$/.test(r), r);
  await fetch(`http://127.0.0.1:${port}/claim?tab=B`, { headers: { Origin: ORIGIN } }); // zadání z panelu v kartě B
  r = await call(); check('zadání z panelu v B → AI pracuje v B, s upozorněním', /^tab B/.test(r) && /another editor tab/.test(r), r);
  r = await call(); check('upozornění jen jednou', r === 'tab B', r);
  A.stop = B.stop = true; proc.kill();
  console.log(ok ? 'connector-pin: OK' : 'connector-pin: FAIL');
  process.exit(ok ? 0 : 1);
})();
