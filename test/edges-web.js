'use strict';
/* Kraje titulků skutečnou cestou aplikace (kolo 5, úkol 3): headless Chrome (stanice, nebo --cpu N + --slow = notebook), přesný přepis
 * vložený do úložiště (jako test/b1.js), pro každý výrok ze seznamu test/edges.js (--list) cutBounds jako klik + Shift+klik a titulky
 * přes __pzASR.seqWords(…, { precise: true }) = přesný přepis zvuku klipu. Výstup = řádky pro `node test/edges.js … --rows <json>`.
 *   node test/edges-web.js <přepis.json> <video> <výstup.json> [--random N --seed S] [--cpu N --slow] [--port 9390]
 */
const { spawn, execSync, execFileSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [tjson, media, outJson] = argv.filter((x, i) => !x.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const PORT = Number(opt('--port', 9390)), CPU = Number(opt('--cpu', 0)), SLOW = argv.includes('--slow');
const PROF = path.join(os.tmpdir(), 'pz-edgesweb-' + Date.now());
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (p) => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => { let b = ''; r.on('data', (d) => { b += d; }); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej));
const kill = () => { try { execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*remote-debugging-port=${PORT}*' } | % { Stop-Process -Id $_.ProcessId -Force -EA SilentlyContinue }"`); } catch (e) { /* už neběží */ } };

(async () => {
  // seznam výroků stejně jako test/edges.js (pojmenované + náhodné podle semínka)
  const pass = ['--random', opt('--random', '10'), '--seed', opt('--seed', '20261122')];
  const list = JSON.parse(execFileSync('node', [path.join(__dirname, 'edges.js'), tjson, media, '--list', ...pass], { encoding: 'utf8', maxBuffer: 1 << 26 }).split(/\r?\n/).filter((l) => l.startsWith('[')).pop());
  const T = require('../web/ai/transcripts');
  const tr = JSON.parse(fs.readFileSync(tjson, 'utf8'));
  const S0 = T.sentences(tr.words);
  const txt = (i) => tr.words.slice(S0[i].w0, S0[i].w1 + 1).map((w) => w.w).join(' ');
  const jobs = list.map((x) => ({ name: x.name, ta: txt(x.a), tb: txt(x.b) }));
  const isAcc = /large/.test(tr.model || '');
  fs.writeFileSync(path.join(__dirname, 'media', '_ew-words.json'), JSON.stringify(tr.words));

  const args = ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROF}`, '--window-size=1366,768', '--no-first-run', 'http://127.0.0.1:8791/'];
  if (CPU) spawn('cmd', ['/c', 'start', '""', '/affinity', ((2 ** CPU) - 1).toString(16).toUpperCase(), CHROME, ...args], { detached: true, stdio: 'ignore' }).unref();
  else spawn(CHROME, args, { detached: true, stdio: 'ignore' }).unref();
  let page = null;
  for (let i = 0; i < 40 && !page; i++) { await sleep(500); try { page = (await getJson('/json')).find((t) => t.type === 'page' && /8791/.test(t.url)); } catch (e) { /* ještě neběží */ } }
  if (!page) throw new Error('Chrome se nespustil');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  let id = 0; const pend = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => {
    const m = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true, timeout: 3600000 });
    if (m.result && m.result.exceptionDetails) throw new Error('JS: ' + JSON.stringify(m.result.exceptionDetails.exception && m.result.exceptionDetails.exception.description).slice(0, 500));
    return m.result && m.result.result && m.result.result.value;
  };
  await sleep(4000);
  const vp = String(media).replace(/\\/g, '/');
  await ev(`${CPU ? `window.__pzAsrThreads = ${CPU};` : ''} ${SLOW ? 'window.__pzAsrSlow = true;' : ''} window.__pzAsrWorkers = 1; __pzASR.setAuto(false);
    TN.app.project.dirty = false; TN.app.cmd('newProject'); await new Promise((r) => setTimeout(r, 500));
    await __pzDevImport('/devfile?p=' + encodeURIComponent(${JSON.stringify(vp)}), 'klip.mp4');
    const m = TN.app.project.media[0]; const f = __pzDev.vfs.getFile(m.path); const cid = await __pzDev.T.contentId(f);
    const words = await (await fetch('/devfile?p=' + encodeURIComponent('O:/TN_strihatko/test/media/_ew-words.json'))).json();
    const db = await new Promise((res, rej) => { const r = indexedDB.open('pz-ai-cut-transcripts', 1); r.onupgradeneeded = () => r.result.createObjectStore('t'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise((res) => { const tx = db.transaction('t', 'readwrite'); tx.objectStore('t').put({ engine: 2, key: cid + '|cs', language: 'cs', model: ${JSON.stringify(tr.model || 'onnx-community/whisper-small_timestamped')}, duration: m.duration, words, created: Date.now() }, cid + '|cs'); tx.oncomplete = res; });
    await __pzASR.load(m); return 1;`);
  const rows = [];
  const t0 = Date.now();
  for (const j of jobs) {
    const r = await ev(`const m = TN.app.project.media[0]; const t = __pzASR.get(m); const S = t.sentences;
      const tx = (i) => t.words.slice(S[i].w0, S[i].w1 + 1).map((w) => w.w).join(' ');
      const a = S.findIndex((s, i) => tx(i) === ${JSON.stringify(j.ta)}); let b = -1; for (let i = Math.max(0, a); i < S.length; i++) if (tx(i) === ${JSON.stringify(j.tb)}) { b = i; break; }
      if (a < 0 || b < 0) return null;
      const bd = await __pzASR.cutBounds(m, t, S[a].w0, S[b].w1);
      const seq = { tracks: { audio: [{ muted: false, clips: [{ mediaId: m.id, in: bd.in, out: bd.out, start: 0 }] }] } };
      const r = await __pzASR.seqWords(seq, { precise: true });
      return { in: bd.in, out: bd.out, inOk: bd.inOk, outOk: bd.outOk, cw: r.words.map((w) => ({ w: w.w, s: w.s, e: w.e })) };`);
    if (!r) { console.log('(nenalezeno v aplikaci)', j.name); continue; }
    rows.push({ name: j.name, ...r });
    process.stdout.write('.');
  }
  console.log(`\n${rows.length} výroků, ${((Date.now() - t0) / 1000).toFixed(0)} s (${isAcc ? 'přesný' : 'standardní'} přepis, ${CPU ? CPU + ' CPU' : 'stanice'}${SLOW ? ', notebook' : ''})`);
  fs.writeFileSync(outJson, JSON.stringify(rows));
  ws.close(); kill();
  try { fs.rmSync(PROF, { recursive: true, force: true }); } catch (e) { /* zamčené */ }
  process.exit(0);
})().catch((e) => { console.error(e); kill(); process.exit(2); });
