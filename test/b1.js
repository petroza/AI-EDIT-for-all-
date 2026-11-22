'use strict';
/* B1 (tasks-4 úkol 1): druhý výrok vložený po titulcích nesmí rozbít sekvenci. Cesta uživatele v samostatném headless Chrome:
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
const OUT = path.resolve(argv[0] && !argv[0].startsWith('--') ? argv[0] : 'team/reports/shots-dev-5');
const APP = Number(opt('--app', 8791)), PORT = Number(opt('--port', 9372)), VAR = opt('--variant', 'end');
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
  const shot = async (name) => { await sleep(400); const img = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, `b1-${VAR}-${name}.png`), Buffer.from(img.result.data, 'base64')); };
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

  // 1. první výrok V5 (#317–320) do nové sekvence + titulky
  R.foot1 = await pick(317, 320); await insert();
  R.cf1 = await captions();
  const s1 = await step('01-v5-titulky');
  if (VAR === 'boundary') { await ev(`TN.app.setPlayhead(0.1); return 1;`); }
  // 2. druhý výrok V2 (#412–415) tlačítkem z Přepisu
  R.foot2 = await pick(412, 415);
  if (VAR === 'boundary') await ev(`TN.app.setPlayhead(0.1); await new Promise((r) => setTimeout(r, 600)); return 1;`);
  await ev(`TN.app.transcript.show('tr'); await new Promise((r) => setTimeout(r, 500)); return 1;`);
  R.insLabel2 = await ev(`return (document.getElementById('trIns') || {}).textContent || null;`);
  await insert();
  const s2 = await step('02-v2-vlozeno');
  if (VAR === 'three') { R.foot3 = await pick(363, 369); await ev(`TN.app.transcript.show('tr'); await new Promise((r) => setTimeout(r, 500)); return 1;`); await insert(); await step('02b-r-vlozeno'); }
  // 3. druhé „Titulky z přepisu“ – doplnit
  R.cf2 = await captions();
  const s3 = await step('03-titulky-doplneno');
  // 4. Zpět / Znovu
  await key('undo'); const s4 = await step('04-zpet-titulky');
  await key('undo'); const s5 = await step('05-zpet-vlozeni');
  await key('redo'); const s6 = await step('06-znovu-vlozeni');
  // kontroly
  const clipsOf = (st) => st.clips.map((c) => [c.start, c.start + c.dur]);
  const own = (st) => st.caps.every((k) => clipsOf(st).some(([a, b]) => k.s >= a - 0.05 && k.e <= b + 0.05));
  const v5caps = s1.caps.length;
  R.checks = {
    noShortClip: s2.clips.every((c) => c.dur >= 1),
    v5WholeFirst: VAR === 'boundary' ? (s2.clips[1] && s2.clips[1].in === s1.clips[0].in && s2.clips[1].dur === s1.clips[0].dur) : (s2.clips[0].start === 0 && s2.clips[0].in === s1.clips[0].in && s2.clips[0].dur === s1.clips[0].dur),
    v5CapsSameRel: (() => { const shift = VAR === 'boundary' ? s2.clips[0].dur : 0; return s1.caps.every((k, i) => s2.caps.some((q) => Math.abs(q.s - (k.s + shift)) < 0.041 && q.t === k.t)); })(),
    noCapOverForeign: own(s2) && own(s3),
    secondCaptionsAdded: s3.caps.length > s2.caps.length,
    v5CapsKept: s1.caps.every((k) => s3.caps.some((q) => q.t === k.t)),
    undoCaptions: s4.caps.length === s2.caps.length,
    undoInsert: VAR === 'three' ? s5.clips.length === s2.clips.length : (s5.clips.length === s1.clips.length && s5.caps.length === v5caps),
    redoInsert: s6.clips.length === (VAR === 'three' ? s2.clips.length + 1 : s2.clips.length),
  };
  console.log('kontroly', JSON.stringify(R.checks));
  fs.writeFileSync(path.join(OUT, `b1-${VAR}.json`), JSON.stringify(R, null, 1));
  ws.close(); kill();
  try { fs.rmSync(PROF, { recursive: true, force: true }); } catch (e) { /* zamčené */ }
  process.exit(Object.values(R.checks).every(Boolean) ? 0 : 1);
})().catch((e) => { console.error(e); kill(); process.exit(2); });
