'use strict';
/* Drobnosti kola 5 (tasks-4 úkol 4) – kopie spouštění z test/b1.js: druhý výrok vložený po titulcích nesmí rozbít sekvenci. Cesta uživatele v samostatném headless Chrome:
 * klik + Shift+klik v Přepisu → Vložit (nová sekvence) → Titulky z přepisu → další výrok klik + Shift+klik → Vložit → znovu Titulky
 * z přepisu → Ctrl+Z / Ctrl+Y. Přesný přepis rozhovoru se do úložiště vloží předem (jako by už byl hotový, ušetří 11 min).
 *   node test/b1.js <složka snímků> [--app 8791] [--port 9372] [--variant end|boundary|three]
 * Výstup: <složka>/b1-<variant>-*.png, <složka>/b1-<variant>.json (klipy a titulky po každém kroku + kontroly). */
const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(argv[0] && !argv[0].startsWith('--') ? argv[0] : 'team/reports/shots-dev-5/u4');
const APP = Number(opt('--app', 8791)), PORT = Number(opt('--port', 9376)), VAR = opt('--variant', 'end');
const VIDEO = 'C:/Users/Petr/Downloads/tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4';
const TR = path.join(__dirname, '..', 'web', 'test-out', 'prepis-presny-po.json');
const PROF = path.join(os.tmpdir(), 'pz-b1-' + Date.now());
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (p) => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => { let b = ''; r.on('data', (d) => { b += d; }); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej));
const kill = () => { try { execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*remote-debugging-port=${PORT}*' } | % { Stop-Process -Id $_.ProcessId -Force -EA SilentlyContinue }"`); } catch (e) { /* už neběží */ } };

(async () => {
  spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROF}`, '--window-size=1366,768', '--no-first-run', `http://127.0.0.1:${APP}/`], { detached: true, stdio: 'ignore' }).unref();
  let page = null;
  for (let i = 0; i < 40 && !page; i++) { await sleep(500); try { page = (await getJson('/json')).find((t) => t.type === 'page' && new RegExp(String(APP)).test(t.url)); } catch (e) { /* ještě neběží */ } }
  if (!page) throw new Error('Chrome se nespustil');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  let id = 0; const pend = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => {
    const m = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true, timeout: 600000 });
    if (m.result && m.result.exceptionDetails) throw new Error('JS: ' + JSON.stringify(m.result.exceptionDetails.exception && m.result.exceptionDetails.exception.description).slice(0, 500));
    return m.result && m.result.result && m.result.result.value;
  };
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await sleep(4000);
  const shot = async (name) => { await sleep(400); const img = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, `u4-${name}.png`), Buffer.from(img.result.data, 'base64')); };
  const R = { app: APP, variant: VAR, steps: [] };
  const STATE = `const s = TN.app.seq(); if (!s) return null; const r3 = (x) => Math.round(x * 100) / 100;
    const tr = s.tracks.audio.find((x) => x.clips.length) || { clips: [] };
    return { playhead: r3(s.playhead), clips: tr.clips.map((c) => ({ start: r3(c.start), in: r3(c.in), out: r3(c.out), dur: r3(c.out - c.in) })), caps: (s.captions || []).map((c) => ({ s: r3(c.start), e: r3(c.end), t: c.text.replace(/\\n/g, ' ') })),
      ins: (document.getElementById('trIns') || {}).textContent || null };`;
  const step = async (name) => { const st = await ev(STATE); R.steps.push({ name, ...st }); await shot(name); console.log(name, JSON.stringify(st).slice(0, 300)); return st; };

  // import + vložení přesného přepisu do úložiště pod otiskem obsahu
  const words = JSON.parse(fs.readFileSync(TR, 'utf8')).words;
  fs.writeFileSync(path.join(__dirname, 'media', '_b1-words.json'), JSON.stringify(words));
  await ev(`window.__pzASR.setAuto(false); TN.app.project.dirty = false; TN.app.cmd('newProject'); await new Promise((r) => setTimeout(r, 500));
    await __pzDevImport('/devfile?p=' + encodeURIComponent('${VIDEO}'), 'rozhovor.mp4');
    const m = TN.app.project.media[0]; const f = __pzDev.vfs.getFile(m.path); const cid = await __pzDev.T.contentId(f);
    const words = await (await fetch('/devfile?p=' + encodeURIComponent('O:/TN_strihatko/test/media/_b1-words.json'))).json();
    const db = await new Promise((res, rej) => { const r = indexedDB.open('pz-ai-cut-transcripts', 1); r.onupgradeneeded = () => r.result.createObjectStore('t'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise((res) => { const tx = db.transaction('t', 'readwrite'); tx.objectStore('t').put({ engine: 2, key: cid + '|cs', language: 'cs', model: 'onnx-community/whisper-large-v3-turbo_timestamped', duration: m.duration, words, created: Date.now() }, cid + '|cs'); tx.oncomplete = res; });
    const t = await __pzASR.load(m); TN.app.openSource(m); TN.app.transcript.show('tr'); await new Promise((r) => setTimeout(r, 800)); return t && t.sentences.length;`);
  const pick = (a, b) => ev(`const row = (i) => document.querySelector('#trList .tr-row[data-i="' + i + '"]');
    row(${a}).scrollIntoView({ block: 'center' }); row(${a}).dispatchEvent(new MouseEvent('click', { bubbles: true })); await new Promise((r) => setTimeout(r, 1200));
    row(${b}).scrollIntoView({ block: 'center' }); row(${b}).dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })); await new Promise((r) => setTimeout(r, 1500)); return document.getElementById('trFoot').innerText.replace(/\\n/g, ' ');`);
  const insert = () => ev(`const b = document.getElementById('trIns'); b.click(); await new Promise((r) => setTimeout(r, 700)); const ok = document.getElementById('sqOk'); if (ok) { ok.click(); await new Promise((r) => setTimeout(r, 1500)); } return 1;`);
  const captions = () => ev(`TN.app.cmd('captionsFromTranscript'); let txt = ''; for (let i = 0; i < 150; i++) { const b = document.getElementById('cfOk'); if (b && !b.disabled && !/až bude|ready/.test(b.textContent)) { txt = b.textContent; break; } await new Promise((r) => setTimeout(r, 200)); }
    const warn = (document.querySelector('.modal .cs-warn') || {}).textContent || ''; document.getElementById('cfOk').click(); await new Promise((r) => setTimeout(r, 1500)); return txt + ' | ' + warn;`);
  const key = (k) => ev(`TN.app.cmd('${k}'); await new Promise((r) => setTimeout(r, 600)); return 1;`);

  const out = {};
  // 4.5 řádky „nepřepsáno“ na začátku a na konci, klik přehraje úsek
  out.gaps = await ev(`const g = [...document.querySelectorAll('#trList .tr-gap')]; return g.map((x) => x.innerText.replace(/\\n/g, ' '));`);
  out.gapPlay = await ev(`const g = [...document.querySelectorAll('#trList .tr-gap')].pop(); g.scrollIntoView(); g.click(); await new Promise((r) => setTimeout(r, 1500)); const t = TN.app.source.time; return { playing: !!(TN.app.source.playing), t };`);
  await ev(`document.getElementById('trList').scrollTop = 0; return 1;`); await shot('gap-radek');
  // 4.2 Delete v otevřeném titulku: výběr, vložení, titulky, klik do titulku, Ctrl+A, Delete
  await pick(317, 320); await insert();
  // redaktor-5: hlavní tlačítko po vložení („Titulky z přepisu…“) otevře dialog, šipka ▼ hledání ne
  out.capBtn = await ev(`TN.app.transcript.show('tr'); await new Promise((r) => setTimeout(r, 600)); const b = document.getElementById('trCapNext'); const lbl = b && b.textContent;
    document.getElementById('trNext').click(); await new Promise((r) => setTimeout(r, 400)); const byArrow = document.getElementById('modal').classList.contains('show');
    if (b) b.click(); await new Promise((r) => setTimeout(r, 800)); const byBtn = document.getElementById('modal').classList.contains('show') && /Titulky z přepisu|Captions from/.test(document.getElementById('modal').innerText);
    document.getElementById('cfNo') && document.getElementById('cfNo').click(); await new Promise((r) => setTimeout(r, 300)); return { lbl, byArrow, byBtn };`);
  await captions();
  out.capsBefore = await ev(`return TN.app.seq().captions.length;`);
  out.del = await ev(`TN.app.transcript.show('cap'); await new Promise((r) => setTimeout(r, 500));
    const tx = document.querySelector('#capList .cap-row[data-i="1"] .tx'); tx.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 5, clientY: 5 })); await new Promise((r) => setTimeout(r, 400));
    const ta = document.querySelector('#capList textarea'); if (!ta) return 'bez editace'; ta.select(); ta.dispatchEvent(new Event('select'));
    const hint = (document.querySelector('.cap-hint') || {}).textContent;
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })); await new Promise((r) => setTimeout(r, 500));
    return { hint, after: TN.app.seq().captions.length, foot: document.getElementById('capFoot').innerText.replace(/\\n/g, ' ') };`);
  await shot('delete-titulek');
  out.undo = await ev(`const h0 = TN.app.project.history.map((x) => x.label).slice(-4); TN.app.cmd('undo'); await new Promise((r) => setTimeout(r, 400)); return { n: TN.app.seq().captions.length, hist: h0, status: document.getElementById('status').textContent };`);
  // 4.4 Esc v systémovém okně uložení: okno zrušeno (AbortError) + Esc → dialog Export zůstane
  out.exportEsc = await ev(`window.showSaveFilePicker = async () => { const e = new Error('The user aborted a request.'); e.name = 'AbortError'; throw e; };
    TN.app.cmd('export'); await new Promise((r) => setTimeout(r, 800)); const go = document.getElementById('exGo'); if (!go) return 'bez dialogu Export';
    go.click(); await new Promise((r) => setTimeout(r, 300)); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((r) => setTimeout(r, 600)); return { open: document.getElementById('modal').classList.contains('show'), msg: (document.getElementById('exMsg') || {}).textContent };`);
  await shot('export-esc');
  await ev(`document.getElementById('exNo') && document.getElementById('exNo').click(); return 1;`);
  // 4.1 automatický přepis vypnutý: texty
  out.autoOff = await ev(`__pzASR.setAuto(false); TN.app.project.dirty = false; TN.app.cmd('newProject'); await new Promise((r) => setTimeout(r, 800));
    TN.app.transcript.show('tr'); await new Promise((r) => setTimeout(r, 300));
    return { prog: (document.querySelector('.mon-empty.onboard') || {}).innerText || '', tr: (document.getElementById('trPane') || {}).innerText || '' };`);
  await shot('auto-vypnuto');
  out.autoOn = await ev(`__pzASR.setAuto(true); TN.app.cmd('newProject'); await new Promise((r) => setTimeout(r, 800)); return { prog: (document.querySelector('.mon-empty.onboard') || {}).innerText || '', key: localStorage.getItem('pzAutoAsr2') };`);
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(OUT, 'u4.json'), JSON.stringify(out, null, 1));
  ws.close(); kill();
  try { fs.rmSync(PROF, { recursive: true, force: true }); } catch (e) { /* zamčené */ }
  process.exit(0);
})().catch((e) => { console.error(e); kill(); process.exit(2); });
