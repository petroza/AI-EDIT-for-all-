'use strict';
/* Notebook – kolo 5 (tasks-4 úkol 2): čistý profil (nic stažené), afinita N CPU, __pzAsrSlow, 5min výřez. Cesta redaktora skriptem:
 * import → standardní přepis (sám) → přesný model se stahuje na pozadí → výrok klik + Shift+klik → Vložit do nové sekvence →
 * Titulky z přepisu (přesně jen úseky) → export. Měří časy kroků, odhad vs. skutečnost, snímky po 5 s během čekání (stejný stav
 * v Přepisu i v Projektu, číslo se mění), titulky.
 *   node test/notebook5.js <složka> [--cpu 8] [--port 9380] [--from "A zjistilo se to"] [--to "připravit"] [--wait-dl]
 * --wait-dl = titulky až po dostažení modelu (měří čistý čas titulků při staženém modelu). */
const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(argv[0] && !argv[0].startsWith('--') ? argv[0] : 'team/reports/shots-dev-5/nb');
const CPU = Number(opt('--cpu', 8)), PORT = Number(opt('--port', 9380 + CPU));
const FROM = opt('--from', 'A zjistilo se to'), TO = opt('--to', 'připravit');
const WAITDL = argv.includes('--wait-dl');
const VIDEO = 'O:/TN_strihatko/test/media/vyrez-5min.mp4';
const PROF = path.join(os.tmpdir(), 'pz-nb5-' + CPU + '-' + Date.now());
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (p) => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => { let b = ''; r.on('data', (d) => { b += d; }); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej));
const kill = () => { try { execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*remote-debugging-port=${PORT}*' } | % { Stop-Process -Id $_.ProcessId -Force -EA SilentlyContinue }"`); } catch (e) { /* už neběží */ } };

(async () => {
  const mask = ((2 ** CPU) - 1).toString(16).toUpperCase();
  spawn('cmd', ['/c', 'start', '""', '/affinity', mask, CHROME, '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROF}`, '--window-size=1366,768', '--no-first-run', 'http://127.0.0.1:8791/'], { detached: true, stdio: 'ignore' }).unref();
  let page = null;
  for (let i = 0; i < 40 && !page; i++) { await sleep(500); try { page = (await getJson('/json')).find((t) => t.type === 'page' && /8791/.test(t.url)); } catch (e) { /* ještě neběží */ } }
  if (!page) throw new Error('Chrome se nespustil');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  let id = 0; const pend = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => {
    const m = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true, timeout: 1200000 });
    if (m.result && m.result.exceptionDetails) throw new Error('JS: ' + JSON.stringify(m.result.exceptionDetails.exception && m.result.exceptionDetails.exception.description).slice(0, 500));
    return m.result && m.result.result && m.result.result.value;
  };
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await sleep(4000);
  let nshot = 0;
  const shot = async (name) => { const img = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, `nb${CPU}-${String(++nshot).padStart(2, '0')}-${name}.png`), Buffer.from(img.result.data, 'base64')); };
  const R = { cpu: CPU, waitDl: WAITDL, t: {}, samples: [] };
  const T0 = Date.now();
  const sec = () => +((Date.now() - T0) / 1000).toFixed(1);
  // texty v Přepisu a v Projektu ve stejném okamžiku (Projekt: štítek klipu + řádek stahování)
  const SAMPLE = `const tx = (id) => { const e = document.getElementById(id); return e && !e.hidden ? e.innerText.replace(/\\s+/g, ' ').trim() : ''; };
    const tag = document.querySelector('.asr-tag'); return { tr: tx('trStatus'), trPf: tx('trPf'), projPf: tx('projPf'), tag: tag ? tag.title || tag.textContent : '', pf: __pzASR.prefetch };`;
  // 1) import (automatický přepis se spustí sám)
  await ev(`window.__pzAsrSlow = true; window.__pzAsrThreads = ${CPU}; window.__pzAsrWorkers = 1;
    TN.app.project.dirty = false; TN.app.cmd('newProject'); await new Promise((r) => setTimeout(r, 500));
    await __pzDevImport('/devfile?p=' + encodeURIComponent('${VIDEO}'), 'rozhovor-rano.mp4'); return 1;`);
  R.t.import = sec();
  let stdDone = null, dlDone = null, lastShot = 0;
  for (;;) {
    const st = await ev(`const m = TN.app.project.media[0]; const s = __pzASR.status(m); return { state: s.state, p: s.p, msg: s.msg || '', auto: __pzASR.auto };`);
    const smp = await ev(SAMPLE);
    R.samples.push({ t: sec(), ...st, ...smp, pf: undefined, pfLoaded: smp.pf.loaded, pfTotal: smp.pf.total, pfState: smp.pf.state });
    if (sec() - lastShot >= 5) { lastShot = sec(); await ev(`TN.app.transcript.show('tr'); return 1;`); await shot('cekani'); }
    if (!stdDone && st.state === 'done') { stdDone = sec(); R.t.standardDone = stdDone; }
    if (!dlDone && smp.pf.state === 'done') { dlDone = sec(); R.t.accurateDownloaded = dlDone; }
    if (stdDone && (!WAITDL || dlDone)) break;
    if (sec() > 1500) throw new Error('čekání přes 25 min');
    await sleep(1000);
  }
  // 2) výrok klik + Shift+klik, vložit do nové sekvence
  const sel = await ev(`const m = TN.app.project.media[0]; const t = __pzASR.get(m); const S = t.sentences; const txt = (i) => t.words.slice(S[i].w0, S[i].w1 + 1).map((w) => w.w).join(' ');
    const nz = (x) => x.toLowerCase().normalize('NFD').replace(/\\p{M}/gu, '');
    const a = S.findIndex((s, i) => nz(txt(i)).includes(nz(${JSON.stringify(FROM)})));
    let b = -1; for (let i = Math.max(0, a); i < S.length && i < a + 12; i++) if (nz(txt(i)).includes(nz(${JSON.stringify(TO)}))) { b = i; break; }
    TN.app.transcript.show('tr'); await new Promise((r) => setTimeout(r, 400));
    const row = (i) => document.querySelector('#trList .tr-row[data-i="' + i + '"]');
    row(a).scrollIntoView({ block: 'center' }); row(a).dispatchEvent(new MouseEvent('click', { bubbles: true })); await new Promise((r) => setTimeout(r, 1200));
    row(b).dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })); await new Promise((r) => setTimeout(r, 1500));
    return { a, b, text: [txt(a), txt(b)], foot: document.getElementById('trFoot').innerText.replace(/\\n/g, ' ') };`);
  R.selection = sel; R.t.selected = sec();
  await shot('vyber');
  await ev(`document.getElementById('trIns').click(); await new Promise((r) => setTimeout(r, 700)); document.getElementById('sqOk').click(); await new Promise((r) => setTimeout(r, 2000)); return 1;`);
  R.t.inserted = sec();
  await shot('vlozeno');
  // 3) titulky z přepisu: text dialogu (odhad) a čas do hotových titulků
  R.dialog = await ev(`TN.app.cmd('captionsFromTranscript'); for (let i = 0; i < 100; i++) { const b = document.getElementById('cfOk'); if (b && !b.disabled && !/až bude|ready/.test(b.textContent)) break; await new Promise((r) => setTimeout(r, 200)); }
    await new Promise((r) => setTimeout(r, 600)); return document.getElementById('cfMsg').innerText.replace(/\\n/g, ' | ');`);
  await shot('dialog');
  const c0 = Date.now();
  await ev(`document.getElementById('cfOk').click(); return 1;`);
  const prog = [];
  for (;;) {
    const r = await ev(`const s = TN.app.seq(); const msg = document.getElementById('cfMsg'); return { n: (s.captions || []).length, msg: msg ? msg.innerText.replace(/\\n/g, ' ') : null, status: (document.getElementById('status') || {}).textContent || '' };`);
    prog.push({ t: +((Date.now() - c0) / 1000).toFixed(1), msg: r.msg });
    if ((Date.now() - c0) % 5000 < 1100) await shot('titulky-prubeh');
    if (r.n) break;
    if (Date.now() - c0 > 900000) throw new Error('titulky přes 15 min');
    await sleep(1000);
  }
  R.t.captionsSec = +((Date.now() - c0) / 1000).toFixed(1);
  R.captionsProgress = prog.filter((p, i) => i % 3 === 0);
  R.captions = await ev(`return TN.app.seq().captions.map((c) => c.text.replace(/\\n/g, ' '));`);
  R.t.captions = sec();
  R.precise = await ev(`return window.__pzLastPrecise || null;`);
  await sleep(800); await shot('titulky');
  // 4) export
  R.export = await ev(`return await __pzDevExport({ name: 'nb5-${CPU}cpu${WAITDL ? '-dl' : ''}.mp4', burn: true, loudness: 'social' });`);
  R.t.mp4 = sec();
  // stav vs. čísla během čekání: intervaly > 10 s se stejným textem bez měnícího se čísla
  let stuck = 0, runStart = null, prevKey = '';
  for (const s of R.samples) {
    const key = [s.tr, s.trPf].join('|');
    if (key === prevKey) { if (runStart === null) runStart = s.t; if (s.t - runStart > 10) stuck++; } else runStart = null;
    prevKey = key;
  }
  R.stuckSamples = stuck;
  R.mismatch = R.samples.filter((s) => s.trPf !== s.projPf).length;
  fs.writeFileSync(path.join(OUT, `nb${CPU}${WAITDL ? '-dl' : ''}.json`), JSON.stringify(R, null, 1));
  console.log(JSON.stringify({ cpu: CPU, t: R.t, dialog: R.dialog, captions: R.captions.slice(0, 4), n: R.captions.length, stuck, mismatch: R.mismatch, export: R.export && R.export.sizeMB }, null, 1));
  ws.close(); kill();
  try { fs.rmSync(PROF, { recursive: true, force: true }); } catch (e) { /* zamčené */ }
  process.exit(0);
})().catch((e) => { console.error(e); kill(); process.exit(2); });
